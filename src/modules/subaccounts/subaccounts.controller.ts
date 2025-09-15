import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { SubaccountsService } from './subaccounts.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

@ApiTags('Subaccounts')
@Controller('subaccounts')
@RequireAuth()
@ApiBearerAuth()
export class SubaccountsController {
  constructor(private readonly subaccountsService: SubaccountsService) {}
  @Post('onboarding/resend-notification')
  @Roles(ROLES.LOCADOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenvia o e-mail com o link de onboarding para o usuário logado',
  })
  async resendOnboardingEmail(@CurrentUser() currentUser: JwtPayload) {
    return this.subaccountsService.resendOnboardingEmail(currentUser.sub);
  }

  @Get('documents/pending')
  @Roles(ROLES.LOCADOR)
  @ApiOperation({
    summary: 'Consulta os documentos pendentes para a subconta do usuário',
  })
  getPendingDocuments(@CurrentUser() currentUser: JwtPayload) {
    return this.subaccountsService.getPendingDocuments(currentUser.sub);
  }

  @Post('documents/upload')
  @Roles(ROLES.LOCADOR)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary:
      'Envia um documento necessário para a subconta (ex: Contrato Social)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo do documento e seu tipo.',
    type: UploadDocumentDto,
  })
  uploadDocument(
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
  ) {
    return this.subaccountsService.processDocumentUpload(
      currentUser.sub,
      body.type,
      file,
    );
  }
}
