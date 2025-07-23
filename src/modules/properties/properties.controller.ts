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
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import {
  CurrentUser,
  RequireAuth,
} from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { PropertyResponseDto } from './dto/response-property.dto';
import { JwtPayload } from 'src/common/interfaces/jwt.payload.interface';
import { SearchPropertyDto } from './dto/search-property.dto';

@ApiTags('Properties')
@ApiBearerAuth()
@RequireAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
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

  @Get()
  @CacheKey('properties_all')
  @CacheTTL(30)
  @ApiOperation({ summary: 'List all properties' })
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
  findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    if (currentUser.role === ROLES.LOCATARIO) {
      return this.propertiesService.findRentedByUser(
        { page, limit },
        currentUser,
      );
    }
    return this.propertiesService.findAll({ page, limit }, currentUser);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search agencies with filters' })
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

  @Delete(':id')
  @Roles(ROLES.ADMIN, ROLES.LOCADOR)
  @ApiOperation({ summary: 'Delete a property' })
  @ApiResponse({ status: 204, description: 'Property deleted' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.propertiesService.remove(id, currentUser);
  }
}
