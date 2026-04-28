import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaymentChannel } from '../../wallet/entities/transaction.entity';
import { QrCodeType } from '../entities/qr-code.entity';

export class TopupDto {
  @ApiProperty({ example: 25000, description: 'Amount in XAF, multiple of 5, ≥ 100' })
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  amount!: number;

  @ApiProperty({ enum: PaymentChannel })
  @IsEnum(PaymentChannel)
  channel!: PaymentChannel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;
}

export class CreateQrDto {
  @ApiProperty({ enum: QrCodeType })
  @IsEnum(QrCodeType)
  type!: QrCodeType;

  @ApiProperty({ required: false, description: 'Required for DYNAMIC, forbidden for STATIC' })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  amount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  @ApiProperty({ required: false, example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class CreatePaymentLinkDto {
  @ApiProperty()
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  amount!: number;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  description!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class PayQrDto {
  @ApiProperty({ description: 'QR payload string starting with KELYO:' })
  @IsString()
  @Matches(/^KELYO:[A-Za-z0-9_-]+$/)
  qrPayload!: string;

  @ApiProperty({ required: false, description: 'Only for STATIC QR' })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  amountIfStatic?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;
}

export class PayLinkDto {
  @ApiProperty()
  @IsString()
  @Length(1, 32)
  slug!: string;
}
