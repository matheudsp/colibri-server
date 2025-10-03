import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';
import { LaunchNotificationsService } from './launch-notifications.service';
import { CreateLaunchNotificationDto } from './dto/create-launch-notification.dto';

@ApiTags('Launch Notifications')
@Controller('launch-notifications')
export class LaunchNotificationsController {
  constructor(
    private readonly launchNotificationsService: LaunchNotificationsService,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cadastra um e-mail para a notificação de lançamento',
  })
  @ApiResponse({ status: 200, description: 'E-mail cadastrado com sucesso.' })
  @ApiResponse({ status: 409, description: 'O e-mail já está cadastrado.' })
  async create(@Body() createDto: CreateLaunchNotificationDto) {
    return this.launchNotificationsService.create(createDto);
  }
}
