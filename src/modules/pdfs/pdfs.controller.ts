import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Delete,
  InternalServerErrorException,
  NotFoundException,
  Res,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { PdfsService } from './pdfs.service';
import { CreatePdfDto } from './dto/create-pdf.dto';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { CurrentUser } from 'src/common/decorator/current-user.decorator';
import { Response } from 'express';
import { PdfResponseDto } from './dto/response-pdf.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { GetContractTemplateResponseDto } from './dto/get-contract-template-response.dto';
import { PdfsTemplateService } from './pdfs.template.service';

@ApiTags('PDFs')
@Controller('pdfs')
export class PdfsController {
  constructor(
    private readonly pdfsService: PdfsService,
    private readonly pdfsTemplateService: PdfsTemplateService,
  ) {}

  @Post('accessory-pdfs/generate')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate a new accessory PDF for a contract (e.g., Judicial Report)',
  })
  @ApiResponse({ status: 201, type: PdfResponseDto })
  @ApiBody({ type: CreatePdfDto })
  async generateAccessoryPdf(
    @Body() createPdfDto: CreatePdfDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfsService.generateAndSaveAccessoryPdf(
      createPdfDto.contractId,
      createPdfDto.pdfType,
      currentUser,
    );
  }

  @Get('accessory-pdfs/contract/:contractId')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all accessory PDFs for a contract' })
  @ApiResponse({ status: 200, type: [PdfResponseDto] })
  async findAccessoryPdfsByContract(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfsService.findAccessoryPdfsByContract(
      contractId,
      currentUser,
    );
  }

  @Get('accessory-pdfs/:id')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get accessory PDF document details' })
  @ApiResponse({ status: 200, type: PdfResponseDto })
  async findOneAccessoryPdf(@Param('id', ParseUUIDPipe) id: string) {
    return this.pdfsService.getAccessoryPdfById(id);
  }

  @Get('accessory-pdfs/:id/signed-url')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get signed Url for an accessory PDF' })
  async getAccessoryPdfSignedUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.pdfsService.getAccessoryPdfSignedUrl(id);
  }

  @Get('accessory-pdfs/:id/download')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download an accessory PDF document' })
  async downloadAccessoryPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.pdfsService.downloadAccessoryPdf(id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.filename}"`,
      );
      result.fileStream.stream.pipe(res);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Erro ao baixar o PDF.');
    }
  }

  @Delete('accessory-pdfs/:id')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an accessory PDF document' })
  async deleteAccessoryPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.pdfsService.deleteAccessoryPdf(id, currentUser);
  }

  @Get('templates/contract-data')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Returns the HTML template and dynamic data for the contract editor.',
  })
  @ApiResponse({ status: 200, type: GetContractTemplateResponseDto })
  @ApiQuery({ name: 'contractId', required: true })
  async getLeaseContractTemplateWithData(
    @Query('contractId', ParseUUIDPipe) contractId: string,
  ): Promise<GetContractTemplateResponseDto> {
    return this.pdfsTemplateService.getContractTemplateWithData(contractId);
  }
}
