import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Delete,
  UploadedFile,
  UseInterceptors,
  InternalServerErrorException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { PdfsService } from './pdfs.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { StorageService } from 'src/storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { PdfResponseDto } from './dto/response-pdf.dto';

@ApiTags('PDFs')
@Controller('pdfs')
export class PdfsController {
  constructor(
    private readonly pdfService: PdfsService,
    private readonly storageService: StorageService,
  ) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a new document PDF' })
  @ApiResponse({
    status: 201,
    description: 'PDF generated successfully.',
  })
  @ApiBody({ type: CreatePdfDto })
  async generatePdf(
    @Body() createPdfDto: CreatePdfDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfService.generatePdf(
      createPdfDto.contractId,
      createPdfDto.pdfType,
      currentUser,
    );
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Upload signed PDF version' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async signPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() signedFile: Express.Multer.File,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfService.signPdf(id, signedFile, currentUser);
  }

  @Get('contract/:contractId')
  @ApiOperation({ summary: 'Get all PDFs for a contract' })
  @ApiParam({
    name: 'contractId',
    description: 'Contract UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    type: [PdfResponseDto],
    description: 'List of PDFs for the project',
  })
  async findByProject(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfService.findByContract(contractId, currentUser);
  }

  @Get(':id/signed-url')
  @ApiOperation({ summary: 'Get signed Url for a PDF' })
  @ApiResponse({
    status: 200,
    description: 'URL signed generated successfully',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  async getSignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    // @CurrentUser() currentUser: JwtPayload,
  ) {
    const pdf = await this.pdfService.getPdfById(id);

    const pathToUse = pdf.signedFilePath || pdf.filePath;
    const signedUrl = await this.storageService.getSignedUrl(pathToUse);
    return { url: signedUrl };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get PDF document details' })
  @ApiParam({
    name: 'id',
    description: 'PDF document UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    type: PdfResponseDto,
    description: 'PDF document details',
  })
  @ApiResponse({
    status: 404,
    description: 'PDF document not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.pdfService.getPdfById(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download PDF document' })
  @ApiParam({
    name: 'id',
    description: 'PDF document UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file download',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'PDF document not found',
  })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    // @CurrentUser() currentUser: JwtPayload,
  ) {
    try {
      const result = await this.pdfService.downloadPdf(id);

      if (!result) {
        throw new NotFoundException('PDF não encontrado');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );

      result.fileStream.stream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao baixar PDF',
      );
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete PDF document' })
  @ApiParam({
    name: 'id',
    description: 'PDF document UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'PDF file download',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'PDF document not found',
  })
  async deletePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfService.deletePdf(id, currentUser);
  }
}
