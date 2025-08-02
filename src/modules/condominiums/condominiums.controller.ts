import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CondominiumsService } from './condominiums.service';
import { CreateCondominiumDto } from './dto/create-condominium.dto';
import { UpdateCondominiumDto } from './dto/update-condominium.dto';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { CondominiumResponseDto } from './dto/response-condominium.dto';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { PropertyResponseDto } from '../properties/dto/response-property.dto';
import { Public } from 'src/common/decorator/public.decorator';
import type { SearchCondominiumDto } from './dto/search-condominium.dto';

@ApiTags('Condominiums')
@Controller('condominiums')
export class CondominiumsController {
  constructor(private readonly condominiumsService: CondominiumsService) {}

  @Post()
  @ApiBearerAuth()
  @RequireAuth()
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({ summary: 'Create a new condominium' })
  @ApiResponse({
    status: 201,
    type: CondominiumResponseDto,
    description: 'Condominium successfully created',
  })
  @ApiBody({ type: CreateCondominiumDto })
  create(
    @Body() createPropertyDto: CreateCondominiumDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.condominiumsService.create(createPropertyDto, currentUser);
  }

  @Get('public')
  @Public()
  @CacheKey('condominiums_public_all')
  @CacheTTL(60)
  @ApiOperation({ summary: 'List all condominiums with available properties' })
  @ApiResponse({ status: 200, type: [CondominiumResponseDto] })
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
  findAvailable(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.condominiumsService.findAvailable({ page, limit });
  }

  @Get()
  @RequireAuth()
  @ApiBearerAuth()
  @CacheTTL(60)
  @ApiOperation({ summary: 'List condominiums for the logged-in user' })
  @ApiResponse({ status: 200, type: [CondominiumResponseDto] })
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
  findUserCondominiums(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.condominiumsService.findUserCondominiums(
      { page, limit },
      currentUser,
    );
  }

  @Get('public/search')
  @Public()
  @ApiOperation({ summary: 'Publicly search for condominiums with filters' })
  @ApiResponse({ status: 200, type: [CondominiumResponseDto] })
  publicSearch(@Query() searchParams: SearchCondominiumDto) {
    return this.condominiumsService.publicSearch(searchParams);
  }

  @Get('search')
  @RequireAuth()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search within your own condominiums (for Admins and Landlords)',
  })
  @ApiResponse({ status: 200, type: [CondominiumResponseDto] })
  search(
    @Query() searchParams: SearchCondominiumDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.condominiumsService.search(searchParams, currentUser);
  }

  @Get(':id/properties')
  @Public()
  @ApiOperation({
    summary: 'List all properties within a specific condominium',
  })
  @ApiResponse({ status: 200, type: [PropertyResponseDto] })
  @ApiParam({ name: 'id', description: 'Condominium UUID' })
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
  findProperties(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.condominiumsService.findPropertiesByCondominium(id, {
      page,
      limit,
    });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a condominium by ID' })
  @ApiParam({ name: 'id', description: 'Condominium UUID' })
  @ApiResponse({
    status: 200,
    type: CondominiumResponseDto,
    description: 'Condominium found',
  })
  @ApiResponse({
    status: 404,
    description: 'Condominium not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.condominiumsService.findOne(id);
  }

  @Patch(':id')
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({ summary: 'Update a condominium' })
  @ApiParam({ name: 'id', description: 'Condominium UUID' })
  @ApiBody({ type: UpdateCondominiumDto })
  @ApiResponse({
    status: 200,
    type: CondominiumResponseDto,
    description: 'Condominium updated',
  })
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdateCondominiumDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.condominiumsService.update(id, updatePropertyDto, currentUser);
  }

  @Delete(':id')
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({ summary: 'Delete a condominium' })
  @ApiResponse({ status: 204, description: 'Condominium deleted' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.condominiumsService.remove(id, currentUser);
  }
}
