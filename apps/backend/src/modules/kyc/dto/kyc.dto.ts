import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { KycDocumentType } from '../entities/kyc-document.entity';

export class RequestUploadDto {
  @ApiProperty({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  docType!: KycDocumentType;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ example: 1572864 })
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  sizeBytes!: number;
}

export class ConfirmUploadDto {
  @ApiProperty({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  docType!: KycDocumentType;

  @ApiProperty()
  @IsString()
  @Length(1, 500)
  storageKey!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class ReviewDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsEnum(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  rejectionReason?: string;
}
