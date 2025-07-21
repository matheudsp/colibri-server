import { Controller, Get, Query, ParseUUIDPipe, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RequireAuth } from 'src/common/decorator/current-user.decorator';
import { Roles } from 'src/common/decorator/roles.decorator';
import { ROLES } from '../../common/constants/roles.constant';
import { LogResponseDto } from './dto/response-log.dto';
import { SearchLogDto } from './dto/search-log.dto';
import { LogService } from './logs.service';

@ApiTags('Logs')
@ApiBearerAuth()
@RequireAuth()
@Roles(ROLES.ADMIN)
@Controller('logs')
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get()
  @ApiOperation({ summary: 'List all logs' })
  @ApiResponse({
    status: 200,
    type: [LogResponseDto],
    description: 'List of logs',
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
  findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.logService.findAll({ page, limit });
  }

  @Get('search')
  @ApiOperation({ summary: 'Search logs with filters' })
  @ApiResponse({
    status: 200,
    type: [LogResponseDto],
    description: 'Search results',
  })
  search(@Query() searchParams: SearchLogDto) {
    return this.logService.search(searchParams);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get logs by user' })
  @ApiResponse({
    status: 200,
    type: [LogResponseDto],
    description: 'User logs',
  })
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.logService.findByUser(userId);
  }
}
