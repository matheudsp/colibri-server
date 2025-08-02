import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorator/public.decorator';
import { WebhooksService } from './webhooks.service';
import { AsaasWebhookGuard } from 'src/auth/guards/asaas-webhook.guard';

@ApiTags('Webhooks')
@Controller('webhooks')
@Public()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('asaas')
  @UseGuards(AsaasWebhookGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Receive events from webhook of Asaas.' })
  @ApiHeader({
    name: 'asaas-access-token',
    description: 'Secure token of webhook.',
  })
  async handleAsaasWebhook(@Body() payload: any) {
    await this.webhooksService.processAsaasEvent(payload);
  }
}
