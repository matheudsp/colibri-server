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
import { ClicksignWebhookGuard } from 'src/auth/guards/clicksign-webhook.guard';

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

  @Post('clicksign')
  @UseGuards(ClicksignWebhookGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive events from Clicksign webhooks.' })
  async handleClicksignWebhook(@Body() payload: any) {
    return this.webhooksService.processClicksignEvent(payload);
  }
}
