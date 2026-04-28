import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator';
import { OtpPurpose } from '../entities/otp-code.entity';

export class RequestOtpDto {
  @ApiProperty({ example: '+24107123456' })
  @IsString()
  @Matches(/^\+\d{8,15}$/, { message: 'Phone must be in E.164 format' })
  phone!: string;

  @ApiProperty({ enum: OtpPurpose, default: OtpPurpose.SIGNUP })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiProperty({ example: 'GA', required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+24107123456' })
  @IsString()
  @Matches(/^\+\d{8,15}$/)
  phone!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ enum: OtpPurpose })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
