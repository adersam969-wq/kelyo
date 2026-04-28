import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { WithdrawalChannel } from '../entities/withdrawal.entity';

export class InitiateWithdrawalDto {
  @ApiProperty({ example: 25000 })
  @IsInt()
  @Min(500)
  @Max(1_000_000_000)
  amount!: number;

  @ApiProperty({ enum: WithdrawalChannel })
  @IsEnum(WithdrawalChannel)
  channel!: WithdrawalChannel;

  @ApiProperty({ example: '+24107123456' })
  @IsString()
  @Matches(/^\+\d{8,15}$/)
  recipientPhone!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  recipientName?: string;
}

export class ConfirmWithdrawalDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{4}$/)
  pin!: string;
}
