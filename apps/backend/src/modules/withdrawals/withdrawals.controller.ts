import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  IdempotencyInterceptor,
  Idempotent,
} from '../../common/interceptors/idempotency.interceptor';
import { WithdrawalsService } from './withdrawals.service';
import { PinService } from '../users/pin.service';
import { ConfirmWithdrawalDto, InitiateWithdrawalDto } from './dto/withdrawal.dto';
import { SetPinDto } from '../users/dto/pin.dto';

@ApiTags('withdrawals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WithdrawalsController {
  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly pin: PinService,
  ) {}

  // ─── PIN management ───────────────────────────────────────────────────────
  @Get('users/me/pin')
  async hasPin(@CurrentUser() user: AuthenticatedUser) {
    return { hasPin: await this.pin.hasPin(user.id) };
  }

  @Post('users/me/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPin(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetPinDto) {
    await this.pin.setPin(user.id, dto.newPin, dto.oldPin);
  }

  // ─── Withdrawal flow ──────────────────────────────────────────────────────
  @Post('wallet/withdraw')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent()
  async initiate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InitiateWithdrawalDto,
  ) {
    return this.withdrawals.initiate({
      userId: user.id,
      amount: dto.amount,
      channel: dto.channel,
      recipientPhone: dto.recipientPhone,
      recipientName: dto.recipientName,
    });
  }

  @Post('wallet/withdraw/:withdrawalId/confirm')
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('withdrawalId') withdrawalId: string,
    @Body() dto: ConfirmWithdrawalDto,
  ) {
    return this.withdrawals.confirmWithPin(user.id, withdrawalId, dto.pin);
  }

  @Get('wallet/withdraw/:withdrawalId')
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('withdrawalId') withdrawalId: string,
  ) {
    return this.withdrawals.getStatus(user.id, withdrawalId);
  }

  @Delete('wallet/withdraw/:withdrawalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('withdrawalId') withdrawalId: string,
  ) {
    await this.withdrawals.cancel(user.id, withdrawalId);
  }
}
