import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum QrCodeType {
  STATIC = 'STATIC', // amount entered by payer at scan time
  DYNAMIC = 'DYNAMIC', // amount fixed by merchant
}

export enum QrCodeStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

@Entity('qr_codes')
@Index(['payload'], { unique: true })
@Index(['merchantId', 'status'])
export class QrCode extends BaseEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({ type: 'enum', enum: QrCodeType })
  type!: QrCodeType;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v == null ? null : parseInt(v, 10)),
    },
  })
  amount?: number | null;

  @Column({ type: 'varchar', length: 3, default: 'XAF' })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: QrCodeStatus, default: QrCodeStatus.ACTIVE })
  status!: QrCodeStatus;

  @Column({ type: 'varchar', length: 64, unique: true })
  payload!: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;
}
