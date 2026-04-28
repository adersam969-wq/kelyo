import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

export enum OtpPurpose {
  SIGNUP = 'SIGNUP',
  LOGIN = 'LOGIN',
  PHONE_CHANGE = 'PHONE_CHANGE',
  PIN_RESET = 'PIN_RESET',
  TRANSACTION_CONFIRM = 'TRANSACTION_CONFIRM',
}

@Entity('otp_codes')
@Index(['phone', 'purpose', 'createdAt'])
export class OtpCode extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose!: OtpPurpose;

  @Column({ name: 'code_hash', type: 'varchar', length: 255, select: false })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @Column({ name: 'invalidated_at', type: 'timestamptz', nullable: true })
  invalidatedAt?: Date | null;
}
