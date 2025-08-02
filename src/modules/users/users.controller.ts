import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  ForbiddenException,
  Body,
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
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { UserResponseDto } from './dto/response-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './users.service';
import {
  CurrentUser,
  RequireAuth,
} from '../../common/decorator/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt.payload.interface';
import { SearchUserDto } from './dto/search-user.dto';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from 'src/common/constants/roles.constant';

@ApiTags('Users')
@ApiBearerAuth()
@RequireAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @CacheKey('users_list')
  @Roles(ROLES.ADMIN)
  @CacheTTL(30) // 30 seconds
  @ApiOperation({ summary: 'List all users (Admin)' })
  @ApiResponse({
    status: 200,
    type: [UserResponseDto],
    description: 'List of users',
  })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(@Query('status') status?: string) {
    return this.userService.findAll({ status });
  }

  @Get('search')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Search users with filters (Admin)' })
  @ApiResponse({
    status: 200,
    type: [UserResponseDto],
    description: 'Search results',
  })
  search(@Query() searchParams: SearchUserDto) {
    return this.userService.search(searchParams);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 200,
    type: UserResponseDto,
    description: 'User profile',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  // @Get('test-email/:id')
  // testEmail(@Param('id', ParseUUIDPipe) id: string) {
  //   return this.userService.testEmail(id);
  // }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    type: UserResponseDto,
    description: 'User profile updated',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: 'Delete user (Admin)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({
    status: 204,
    description: 'User successfully deleted',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.remove(id);
  }
}
