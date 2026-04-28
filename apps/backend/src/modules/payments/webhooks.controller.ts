import { Body, Controller, Headers, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaymentsWebhooksService } from './webhooks.service';
import { CinetPayWebhookPayload } from '../cinetpay/types';

@ApiTags('webhooks')
@Controller('webhooks/cinetpay')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooks: PaymentsWebhooksService) {}

  /**
   * Public endpoint for CinetPay payment notifications.
   *
   * IMPORTANT: We always return 200 OK even on internal errors. CinetPay retries
   * on non-2xx responses, which would amplify problems if our handler is buggy.
   * Errors are logged in the webhook_events table for ops to investigate and replay.
   */
  @Public()
  @Post('payment')
  @HttpCode(HttpStatus.OK)
  async handlePayment(
    @Body() payload: CinetPayWebhookPayload,
    @Headers('x-token') xToken?: string,
  ) {
    try {
      const result = await this.webhooks.handlePaymentWebhook(payload, xToken);
      return { received: true, ...result };
    } catch (err) {
      this.logger.error('Webhook processing crashed', err as Error);
      return { received: true, ok: false, reason: 'internal_error' };
    }
  }
}
