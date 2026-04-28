import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RefreshDto, RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone, dto.purpose, dto.countryCode);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.auth.verifyOtpAndAuthenticate(
      dto.phone,
      dto.code,
      dto.purpose,
      'GA',
      { userAgent, ip },
    );
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto, @Ip() ip: string, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ip,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user.id);
  }
}
