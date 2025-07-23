import { Injectable, NotFoundException } from '@nestjs/common';
import { FileUpload, StorageResult } from './types/file-upload.type';
import { SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { InjectSupabaseClient } from 'nestjs-supabase-js';
import { Readable } from 'stream';
import {
  FileBufferResult,
  FileStreamResult,
} from '../common/interfaces/storage.interface';

@Injectable()
export class StorageService {
  private readonly bucketName: string;

  constructor(
    @InjectSupabaseClient() private supabase: SupabaseClient,
    private config: ConfigService,
  ) {
    this.bucketName = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
  }

  async uploadFile(file: FileUpload, bucket?: string): Promise<StorageResult> {
    const targetBucket = bucket || this.bucketName;

    try {
      const { data: bucketExists, error: bucketError } =
        await this.supabase.storage.getBucket(targetBucket);

      if (bucketError || !bucketExists) {
        throw new Error(
          `Bucket "${targetBucket}" não encontrado. Crie-o no painel do Supabase.`,
        );
      }

      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('Arquivo vazio');
      }

      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `Tamanho do arquivo excede o limite de ${MAX_FILE_SIZE} bytes`,
        );
      }

      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ];

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new Error(
          'Tipo de arquivo não suportado. São permitidos: JPEG, PNG, GIF, WEBP, PDF',
        );
      }

      const getExtension = () => {
        if (file.mimetype === 'image/jpeg') return 'jpg';
        if (file.mimetype === 'image/png') return 'png';
        if (file.mimetype === 'image/gif') return 'gif';
        if (file.mimetype === 'image/webp') return 'webp';
        if (file.mimetype === 'application/pdf') return 'pdf';
        return 'bin';
      };

      const sanitizedName = (file.originalname || `file-${Date.now()}`)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '-')
        .replace(/\.[^/.]+$/, '')
        .substring(0, 100);

      const fileExt =
        file.originalname?.split('.').pop()?.toLowerCase() || getExtension();
      const folder = file.mimetype.startsWith('image/') ? 'Images' : 'Pdfs';

      const filePath = `${folder}/${Date.now()}-${sanitizedName}.${fileExt}`;

      const { error } = await this.supabase.storage
        .from(targetBucket)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
          cacheControl: '3600',
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      return {
        url: await this.getSignedUrl(filePath),
        key: filePath,
        metadata: {
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date(),
        },
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Storage upload error:', error);
        throw new Error(`Falha no armazenamento: ${error.message}`);
      }
      throw new Error('Ocorreu um erro desconhecido durante o upload');
    }
  }

  async getFileStream(
    filePath: string,
    bucket?: string,
  ): Promise<FileStreamResult> {
    const targetBucket = bucket || this.bucketName;

    try {
      const { data: fileInfo } = this.supabase.storage
        .from(targetBucket)
        .getPublicUrl(filePath);

      if (!fileInfo) {
        throw new NotFoundException(`Arquivo não encontrado: ${filePath}`);
      }

      const { data: downloadData, error: downloadError } =
        await this.supabase.storage.from(targetBucket).download(filePath);

      if (downloadError || !downloadData) {
        throw new Error(downloadError?.message || 'Falha ao baixar o arquivo');
      }

      const stream = new Readable();
      stream.push(Buffer.from(await downloadData.arrayBuffer()));
      stream.push(null);

      return {
        stream,
        metadata: {
          contentType: 'application/pdf',
          contentLength: downloadData.size,
          originalName: filePath.split('/').pop() || 'document.pdf',
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(
        `Erro ao obter o arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
      );
    }
  }

  async getFileBuffer(
    filePath: string,
    bucket?: string,
  ): Promise<FileBufferResult> {
    const targetBucket = bucket || this.bucketName;

    try {
      const { data: downloadData, error: downloadError } =
        await this.supabase.storage.from(targetBucket).download(filePath);

      if (downloadError || !downloadData) {
        throw new Error(downloadError?.message || 'Falha ao baixar o arquivo');
      }

      const buffer = Buffer.from(await downloadData.arrayBuffer());

      const { data: fileList, error: listError } = await this.supabase.storage
        .from(targetBucket)
        .list('', { search: filePath.split('/').pop() });

      if (listError || !fileList || fileList.length === 0) {
        throw new Error(listError?.message || 'Falha ao obter metadados');
      }

      const fileMeta = fileList.find(
        (file) => file.name === filePath.split('/').pop(),
      );

      return {
        buffer,
        metadata: {
          contentType:
            (fileMeta?.metadata as { mimetype?: string })?.mimetype ||
            'application/octet-stream',
          contentLength:
            (fileMeta?.metadata as { size?: number })?.size ||
            downloadData.size,
          originalName: filePath.split('/').pop() || 'file',
        },
      };
    } catch (error) {
      const typedError = error as Error;
      throw new Error(`Erro ao obter o arquivo: ${typedError.message}`);
    }
  }

  async getSignedUrl(
    filePath: string,
    bucket?: string,
    expiresIn = 60 * 60 * 24 * 7, // 7 dias
  ): Promise<string> {
    const targetBucket = bucket || this.bucketName;

    const { data: signedUrlData, error } = await this.supabase.storage
      .from(targetBucket)
      .createSignedUrl(filePath, expiresIn);

    if (error || !signedUrlData?.signedUrl) {
      throw new Error(`Erro ao gerar URL assinada: ${error?.message}`);
    }

    return signedUrlData.signedUrl;
  }

  async deleteFile(filePath: string, bucket?: string): Promise<void> {
    const targetBucket = bucket || this.bucketName;

    const { error } = await this.supabase.storage
      .from(targetBucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  getFileUrl(filePath: string, bucket?: string): string {
    const targetBucket = bucket || this.bucketName;

    const {
      data: { publicUrl },
    } = this.supabase.storage.from(targetBucket).getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL');
    }

    return publicUrl;
  }
}
