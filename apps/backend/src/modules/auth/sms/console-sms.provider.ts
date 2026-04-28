import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../../../common/utils/phone';

export interface SmsProvider {
  send(phone: string, body: string): Promise<void>;
}

/**
 * Dev SMS provider — logs OTP to console.
 * Production: replace with Twilio / Africa's Talking / local CEMAC aggregator.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async send(phone: string, body: string): Promise<void> {
    this.logger.log(`📱 SMS to ${maskPhone(phone)}: ${body}`);
  }
}
