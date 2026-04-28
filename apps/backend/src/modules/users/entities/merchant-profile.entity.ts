import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

@Entity('merchant_profiles')
export class MerchantProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  businessName!: string;

  @Column({ name: 'business_type', type: 'varchar', length: 100 })
  businessType!: string;

  @Column({ name: 'rccm_number', type: 'varchar', length: 100, nullable: true })
  rccmNumber?: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city?: string | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;
}
