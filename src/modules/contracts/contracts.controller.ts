import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  Put,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ContractResponseDto } from './dto/response-contract.dto';
import { ResendNotificationDto } from './dto/resend-notification.dto';
import { ContractLifecycleService } from './contracts.lifecycle.service';
import { ContractSignatureService } from './contracts.signature.service';
import { UpdateContractHtmlDto } from './dto/update-contract-html.dto';
import { RequestContractAlterationDto } from './dto/request-contract-alteration.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@RequireAuth()
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly contractLifecycleService: ContractLifecycleService,
    private readonly contractSignatureService: ContractSignatureService,
  ) {}

  @Get(':id/pdf-url')
  @ApiOperation({ summary: 'Get a signed URL to view the contract PDF' })
  @ApiResponse({
    status: 200,
    description: 'Returns a temporary signed URL for the PDF file.',
  })
  async getContractPdfUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractSignatureService.getContractPdfSignedUrl(
      id,
      currentUser,
    );
  }

  @Post(':id/request-signature')
  @ApiOperation({ summary: 'Request digital signatures via Clicksign' })
  async requestSignature(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractSignatureService.requestSignature(id, currentUser);
  }

  @Post(':id/resend-notification')
  @ApiOperation({
    summary: 'Re-sends a signature notification to a specific signer.',
  })
  @ApiBody({ type: ResendNotificationDto })
  async resendNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() resendNotificationDto: ResendNotificationDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const { signerId } = resendNotificationDto;
    return this.contractSignatureService.resendNotification(
      id,
      signerId,
      currentUser,
    );
  }

  @Post()
  @Roles(ROLES.LOCADOR)
  @ApiOperation({ summary: 'Create a new contract' })
  @ApiResponse({
    status: 201,
    type: ContractResponseDto,
    description: 'Contract successfully created',
  })
  @ApiBody({ type: CreateContractDto })
  create(
    @Body() createContractDto: CreateContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.create(createContractDto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: 'List all contracts' })
  @ApiResponse({
    status: 200,
    type: [ContractResponseDto],
    description: 'List of contracts',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of items per page',
  })
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.findAll({ page, limit }, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an contract by ID' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiResponse({
    status: 200,
    type: ContractResponseDto,
    description: 'Contract found',
  })
  @ApiResponse({
    status: 404,
    description: 'Contract not found',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.findOne(id, currentUser);
  }

  @Put(':id')
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({ summary: 'Update an contract' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiBody({ type: UpdateContractDto })
  @ApiResponse({
    status: 200,
    type: UpdateContractDto,
    description: 'Contract updated',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateContractDto: UpdateContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.update(
      id,
      updateContractDto,
      currentUser,
    );
  }

  @Patch(':id/activate')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({ summary: 'Activate a contract and generate payments' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.forceActivateContract(id, currentUser);
  }

  @Patch(':id/cancel')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({ summary: 'Cancel a contract' })
  @ApiResponse({ status: 200, description: 'Contract successfully cancelled.' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.cancelContract(id, currentUser);
  }

  @Delete(':id')
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({ summary: 'Delete an contract' })
  @ApiParam({ name: 'id', description: 'Contract UUID' })
  @ApiResponse({
    status: 204,
    description: 'Contract deleted',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.remove(id, currentUser);
  }

  @Patch(':id/contract-html')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save the edited HTML content for a contract' })
  @ApiBody({ type: UpdateContractHtmlDto })
  updateContractHtml(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateContractHtmlDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.updateContractHtml(
      id,
      updateDto,
      currentUser,
    );
  }

  @Patch(':id/accept')
  @Roles(ROLES.LOCATARIO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inquilino aceita os termos do contrato' })
  tenantAcceptsContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractLifecycleService.tenantAcceptsContract(id, currentUser);
  }

  @Patch(':id/request-alteration')
  @Roles(ROLES.LOCATARIO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inquilino solicita alteração no contrato' })
  @ApiBody({ type: RequestContractAlterationDto })
  tenantRequestsAlteration(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: RequestContractAlterationDto,
  ) {
    return this.contractLifecycleService.tenantRequestsAlteration(
      id,
      currentUser,
      dto,
    );
  }

  @Get(':id/review')
  @Roles(ROLES.LOCATARIO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtém o HTML do contrato para revisão e aceite do inquilino',
  })
  @ApiResponse({
    status: 200,
    description: 'HTML do contrato renderizado com os dados.',
  })
  async getContractForReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ renderedHtml: string }> {
    return this.contractsService.getContractHtmlForTenantAcceptance(
      id,
      currentUser.sub,
    );
  }
}
