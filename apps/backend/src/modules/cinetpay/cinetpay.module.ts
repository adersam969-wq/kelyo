import { Module } from '@nestjs/common';
import { CinetPayClient } from './cinetpay.client';

@Module({
  providers: [CinetPayClient],
  exports: [CinetPayClient],
})
export class CinetPayModule {}
