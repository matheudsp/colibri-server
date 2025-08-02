import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  Query,
  Put,
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
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { ContractResponseDto } from './dto/response-contract.dto';

@ApiTags('Contracts')
@ApiBearerAuth()
@RequireAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

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
    return this.contractsService.create(createContractDto, currentUser);
  }

  @Get()
  // @CacheKey('contracts_all')
  // @CacheTTL(30)
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
    return this.contractsService.update(id, updateContractDto, currentUser);
  }

  @Patch(':id/activate')
  @Roles(ROLES.LOCADOR, ROLES.ADMIN)
  @ApiOperation({ summary: 'Activate a contract and generate payments' })
  @ApiResponse({ status: 200, type: ContractResponseDto })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.activateContract(id, currentUser);
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
    return this.contractsService.remove(id, currentUser);
  }
}
