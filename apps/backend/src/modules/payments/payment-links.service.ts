import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { PaymentLink, PaymentLinkStatus } from './entities/payment-link.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { assertValidAmount } from '../../common/utils/money';

@Injectable()
export class PaymentLinksService {
  constructor(
    @InjectRepository(PaymentLink) private readonly links: Repository<PaymentLink>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(input: {
    merchantId: string;
    amount: number;
    description: string;
    expiresAt?: Date | null;
  }): Promise<PaymentLink> {
    assertValidAmount(input.amount);

    const merchant = await this.users.findOne({ where: { id: input.merchantId } });
    if (!merchant) throw new NotFoundException('Merchant not found');
    if (merchant.role !== UserRole.MERCHANT && merchant.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only merchants can create payment links');
    }

    const slug = randomBytes(10).toString('base64url'); // ~14 chars
    return this.links.save(
      this.links.create({
        merchantId: input.merchantId,
        slug,
        amount: input.amount,
        currency: 'XAF',
        description: input.description,
        status: PaymentLinkStatus.ACTIVE,
        expiresAt: input.expiresAt ?? null,
      }),
    );
  }

  async getPublic(slug: string): Promise<{
    slug: string;
    merchantName: string;
    amount: number;
    currency: string;
    description: string;
    status: PaymentLinkStatus;
    expiresAt: Date | null;
  }> {
    const row = await this.links
      .createQueryBuilder('l')
      .innerJoin('users', 'u', 'u.id = l.merchant_id')
      .leftJoin('merchant_profiles', 'mp', 'mp.user_id = u.id')
      .select([
        'l.slug AS slug',
        'l.amount AS amount',
        'l.currency AS currency',
        'l.description AS description',
        'l.status AS status',
        'l.expires_at AS "expiresAt"',
        `COALESCE(mp.business_name, CONCAT(u.first_name, ' ', u.last_name), 'Marchand') AS "merchantName"`,
      ])
      .where('l.slug = :slug', { slug })
      .getRawOne();

    if (!row) throw new NotFoundException('Payment link not found');

    if (row.status === PaymentLinkStatus.EXPIRED) {
      throw new BadRequestException('Payment link expired');
    }
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
      throw new BadRequestException('Payment link expired');
    }
    return {
      slug: row.slug,
      merchantName: row.merchantName,
      amount: parseInt(row.amount, 10),
      currency: row.currency,
      description: row.description,
      status: row.status,
      expiresAt: row.expiresAt,
    };
  }

  async listForMerchant(merchantId: string, page = 1, pageSize = 20) {
    const [items, total] = await this.links.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async cancel(merchantId: string, linkId: string): Promise<void> {
    const link = await this.links.findOne({ where: { id: linkId, merchantId } });
    if (!link) throw new NotFoundException('Payment link not found');
    if (link.status === PaymentLinkStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid link');
    }
    await this.links.update({ id: linkId }, { status: PaymentLinkStatus.CANCELLED });
  }
}
