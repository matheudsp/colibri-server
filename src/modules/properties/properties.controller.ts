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
  UseInterceptors,
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

import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { PropertyResponseDto } from './dto/response-property.dto';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { SearchPropertyDto } from './dto/search-property.dto';
import { Public } from 'src/common/decorator/public.decorator';
import { DeletePropertyDto } from './dto/delete-property.dto';

@ApiTags('Properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @ApiBearerAuth()
  @RequireAuth()
  @ApiOperation({ summary: 'Create a new property' })
  @ApiResponse({
    status: 201,
    type: PropertyResponseDto,
    description: 'Property successfully created',
  })
  @ApiBody({ type: CreatePropertyDto })
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  create(
    @Body() createPropertyDto: CreatePropertyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.propertiesService.create(createPropertyDto, currentUser);
  }
  @Get('public/most-interested')
  @Public()
  @ApiOperation({ summary: 'List properties with the most interested users' })
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
  findMostInterested(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.propertiesService.findMostInterested({ page, limit });
  }

  @Get('public')
  // @UseInterceptors(CacheInterceptor)
  // @CacheTTL(60 * 5)
  @Public()
  @ApiOperation({ summary: 'List all available properties for rent' })
  @ApiResponse({
    status: 200,
    type: [PropertyResponseDto],
    description: 'List of properties',
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
  findAvailable(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.propertiesService.findAvailable({ page, limit });
  }

  @Get()
  @RequireAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List properties for the logged-in user' })
  @ApiResponse({ status: 200, type: [PropertyResponseDto] })
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
  findUserProperties(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.propertiesService.findUserProperties(
      { page, limit },
      currentUser,
    );
  }

  @Get('public/search')
  @Public()
  @ApiOperation({ summary: 'Search available properties with filters' })
  @ApiResponse({
    status: 200,
    type: [PropertyResponseDto],
    description: 'Search results of available properties',
  })
  publicSearch(@Query() searchParams: SearchPropertyDto) {
    return this.propertiesService.publicSearch(searchParams);
  }

  @Get('search')
  @RequireAuth()
  @ApiBearerAuth()
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({
    summary: 'Search within your own properties (for Admins and Landlords)',
  })
  @ApiResponse({
    status: 200,
    type: [PropertyResponseDto],
    description: 'Search results',
  })
  search(
    @Query() searchParams: SearchPropertyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.propertiesService.search(searchParams, currentUser);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get an property by ID' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiResponse({
    status: 200,
    type: PropertyResponseDto,
    description: 'Property found',
  })
  @ApiResponse({
    status: 404,
    description: 'Property not found',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.propertiesService.findOne(id);
  }

  @Patch(':id')
  @RequireAuth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an property' })
  @ApiParam({ name: 'id', description: 'Property UUID' })
  @ApiBody({ type: UpdatePropertyDto })
  @ApiResponse({
    status: 200,
    type: PropertyResponseDto,
    description: 'Property updated',
  })
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  update(
    @Param('id') id: string,
    @Body() updatePropertyDto: UpdatePropertyDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.propertiesService.update(id, updatePropertyDto, currentUser);
  }

  @Post(':id/delete')
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({
    summary: 'Delete a property (requires verification for landlords)',
  })
  @ApiResponse({ status: 200, description: 'Property deleted successfully' })
  @ApiBody({ type: DeletePropertyDto })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() deletePropertyDto: DeletePropertyDto,
  ) {
    return this.propertiesService.remove(id, currentUser, deletePropertyDto);
  }
}
