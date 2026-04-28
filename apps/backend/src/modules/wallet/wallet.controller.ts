import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  AuthenticatedUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import {
  IdempotencyInterceptor,
  Idempotent,
} from "../../common/interceptors/idempotency.interceptor";
import { WalletService } from "./wallet.service";
import { TransferDto } from "./dto/transfer.dto";

@ApiTags("wallet")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("wallet")
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  async getMine(@CurrentUser() user: AuthenticatedUser) {
    const w = await this.wallet.getWalletForUser(user.id);
    return {
      id: w.id,
      currency: w.currency,
      balance: w.balance,
      availableBalance: w.availableBalance,
      status: w.status,
    };
  }

  @Get("transactions")
  async listTx(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const result = await this.wallet.listTransactions(
      user.id,
      page,
      Math.min(pageSize, 100),
    );
    return { data: result.items, meta: { total: result.total, page, pageSize } };
  }

  @Post("transfer")
  @ApiHeader({ name: "Idempotency-Key", required: true })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent()
  async transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferDto) {
    return this.wallet.transferP2P({
      fromUserId: user.id,
      toRecipient: dto.toRecipient,
      amount: dto.amount,
      description: dto.description,
    });
  }
}
