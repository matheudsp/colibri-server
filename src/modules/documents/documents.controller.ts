import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Body,
  Get,
  Patch,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentResponseDto } from './dto/response-document.dto';
import type { UpdateDocumentStatusDto } from './dto/update-document-status.dto';

@ApiTags('Documents')
@RequireAuth()
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('contracts/:contractId/upload')
  @Roles(ROLES.LOCATARIO, ROLES.LOCADOR, ROLES.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document for a contract' })
  uploadDocument(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() createDocumentDto: CreateDocumentDto,
  ) {
    return this.documentsService.uploadDocument(
      contractId,
      currentUser,
      file,
      createDocumentDto.type,
    );
  }

  @Get('contracts/:contractId/documents')
  @Roles(ROLES.LOCATARIO, ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({ summary: 'List all documents for a specific contract' })
  @ApiResponse({ status: 200, type: [DocumentResponseDto] })
  findByContract(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.documentsService.findByContract(contractId, currentUser);
  }

  @Patch(':documentId')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({ summary: 'Update the status of a document (Approve/Reject)' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  updateStatus(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() updateStatusDto: UpdateDocumentStatusDto,
  ) {
    return this.documentsService.updateStatus(
      documentId,
      updateStatusDto.status,
      currentUser,
      updateStatusDto.rejectionReason,
    );
  }
}
