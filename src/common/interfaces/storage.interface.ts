import { Readable } from 'stream';

export interface FileMetadata {
  contentType: string;
  contentLength: number;
  originalName: string;
  [key: string]: unknown;
}

export interface FileStreamResult {
  stream: Readable;
  metadata: FileMetadata;
}

export interface FileBufferResult {
  buffer: Buffer;
  metadata: FileMetadata;
}

export interface StorageResult {
  url: string;
  key: string;
  metadata: {
    size: number;
    mimetype: string;
    uploadedAt: Date;
  };
}
