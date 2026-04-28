import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { KycService } from './kyc.service';
import { ConfirmUploadDto, RequestUploadDto, ReviewDto } from './dto/kyc.dto';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('kyc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post('upload-url')
  async requestUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestUploadDto,
  ) {
    return this.kyc.requestUploadUrl({
      userId: user.id,
      docType: dto.docType,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  @Post('confirm')
  async confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmUploadDto) {
    return this.kyc.confirmUpload({
      userId: user.id,
      docType: dto.docType,
      storageKey: dto.storageKey,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
    });
  }

  // Admin endpoints
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/pending')
  async listPending(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    const result = await this.kyc.listPending(page, Math.min(pageSize, 100));
    return { data: result.items, meta: { total: result.total, page, pageSize } };
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/review/:documentId')
  async review(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewDto,
  ) {
    return this.kyc.reviewDocument({
      documentId,
      adminId: admin.id,
      decision: dto.decision,
      rejectionReason: dto.rejectionReason,
    });
  }
}
