import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { QrCode, QrCodeStatus, QrCodeType } from './entities/qr-code.entity';
import { UserRole, User } from '../users/entities/user.entity';
import { assertValidAmount } from '../../common/utils/money';

const QR_PREFIX = 'KELYO:';

@Injectable()
export class QrCodesService {
  constructor(
    @InjectRepository(QrCode) private readonly qrs: Repository<QrCode>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async createForMerchant(input: {
    merchantId: string;
    type: QrCodeType;
    amount?: number;
    description?: string;
    expiresAt?: Date | null;
  }): Promise<QrCode> {
    const merchant = await this.users.findOne({ where: { id: input.merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.role !== UserRole.MERCHANT && merchant.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only merchants can create QR codes');
    }

    if (input.type === QrCodeType.DYNAMIC) {
      if (!input.amount) {
        throw new BadRequestException('Dynamic QR requires an amount');
      }
      assertValidAmount(input.amount);
    } else if (input.amount !== undefined && input.amount !== null) {
      throw new BadRequestException('Static QR cannot have an amount');
    }

    const payload = QR_PREFIX + randomBytes(24).toString('base64url');

    return this.qrs.save(
      this.qrs.create({
        merchantId: input.merchantId,
        type: input.type,
        amount: input.amount ?? null,
        description: input.description ?? null,
        status: QrCodeStatus.ACTIVE,
        payload,
        expiresAt: input.expiresAt ?? null,
        currency: 'XAF',
      }),
    );
  }

  async listForMerchant(merchantId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.qrs.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async resolvePayload(payload: string): Promise<QrCode> {
    if (!payload.startsWith(QR_PREFIX)) {
      throw new BadRequestException('Invalid QR payload');
    }
    const qr = await this.qrs.findOne({ where: { payload } });
    if (!qr) throw new NotFoundException('QR code not found');
    if (qr.status !== QrCodeStatus.ACTIVE) {
      throw new BadRequestException(`QR code is ${qr.status}`);
    }
    if (qr.expiresAt && qr.expiresAt < new Date()) {
      throw new BadRequestException('QR code expired');
    }
    return qr;
  }

  async revoke(merchantId: string, qrId: string): Promise<void> {
    const qr = await this.qrs.findOne({ where: { id: qrId, merchantId } });
    if (!qr) throw new NotFoundException('QR code not found');
    await this.qrs.update({ id: qrId }, { status: QrCodeStatus.REVOKED });
  }
}
