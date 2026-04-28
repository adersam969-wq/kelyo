import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class SetPinDto {
  @ApiProperty({ example: '4827' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
  newPin!: string;

  @ApiProperty({ required: false, description: 'Required when changing existing PIN' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/)
  oldPin?: string;
}
