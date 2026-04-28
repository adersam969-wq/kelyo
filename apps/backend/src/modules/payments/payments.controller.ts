import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  IdempotencyInterceptor,
  Idempotent,
} from '../../common/interceptors/idempotency.interceptor';
import { TopupService } from './topup.service';
import { QrCodesService } from './qr-codes.service';
import { PaymentLinksService } from './payment-links.service';
import { PayService } from './pay.service';
import {
  CreatePaymentLinkDto,
  CreateQrDto,
  PayLinkDto,
  PayQrDto,
  TopupDto,
} from './dto/payments.dto';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(
    private readonly topup: TopupService,
    private readonly qrs: QrCodesService,
    private readonly links: PaymentLinksService,
    private readonly pay: PayService,
  ) {}

  // ─── Top-up ───────────────────────────────────────────────────────────────
  @Post('wallet/topup')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent()
  async initiateTopup(@CurrentUser() user: AuthenticatedUser, @Body() dto: TopupDto) {
    return this.topup.initiateTopup({
      userId: user.id,
      amount: dto.amount,
      channel: dto.channel,
      description: dto.description,
    });
  }

  @Get('wallet/topup/:transactionId')
  async topupStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
  ) {
    return this.topup.getTopupStatus(user.id, transactionId);
  }

  // ─── Merchant: QR codes ───────────────────────────────────────────────────
  @Post('merchant/qr')
  async createQr(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateQrDto) {
    const qr = await this.qrs.createForMerchant({
      merchantId: user.id,
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return {
      id: qr.id,
      type: qr.type,
      amount: qr.amount,
      currency: qr.currency,
      payload: qr.payload,
      status: qr.status,
      expiresAt: qr.expiresAt,
    };
  }

  @Get('merchant/qr')
  async listQr(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const result = await this.qrs.listForMerchant(user.id, page, Math.min(pageSize, 100));
    return { data: result.items, meta: { total: result.total, page, pageSize } };
  }

  @Delete('merchant/qr/:qrId')
  async revokeQr(@CurrentUser() user: AuthenticatedUser, @Param('qrId') qrId: string) {
    await this.qrs.revoke(user.id, qrId);
    return { revoked: true };
  }

  // ─── Merchant: Payment links ──────────────────────────────────────────────
  @Post('merchant/payment-links')
  async createLink(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentLinkDto,
  ) {
    const link = await this.links.create({
      merchantId: user.id,
      amount: dto.amount,
      description: dto.description,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return {
      id: link.id,
      slug: link.slug,
      amount: link.amount,
      currency: link.currency,
      description: link.description,
      status: link.status,
      expiresAt: link.expiresAt,
    };
  }

  @Get('merchant/payment-links')
  async listLinks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const result = await this.links.listForMerchant(user.id, page, Math.min(pageSize, 100));
    return { data: result.items, meta: { total: result.total, page, pageSize } };
  }

  @Delete('merchant/payment-links/:linkId')
  async cancelLink(
    @CurrentUser() user: AuthenticatedUser,
    @Param('linkId') linkId: string,
  ) {
    await this.links.cancel(user.id, linkId);
    return { cancelled: true };
  }

  // ─── Public: Resolve a payment link slug (for the pay page UI) ────────────
  @Public()
  @Get('payment-links/:slug')
  async getLinkPublic(@Param('slug') slug: string) {
    return this.links.getPublic(slug);
  }

  // ─── Pay actions (require auth) ───────────────────────────────────────────
  @Post('payments/pay-qr')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent()
  async payQr(@CurrentUser() user: AuthenticatedUser, @Body() dto: PayQrDto) {
    return this.pay.payByQr({
      payerUserId: user.id,
      qrPayload: dto.qrPayload,
      amountIfStatic: dto.amountIfStatic,
      description: dto.description,
    });
  }

  @Post('payments/pay-link')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent()
  async payLink(@CurrentUser() user: AuthenticatedUser, @Body() dto: PayLinkDto) {
    return this.pay.payByLink({ payerUserId: user.id, slug: dto.slug });
  }
}
