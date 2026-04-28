import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycDocument } from './entities/kyc-document.entity';
import { User } from '../users/entities/user.entity';
import { KycService } from './kyc.service';
import { StorageService } from './storage.service';
import { KycController } from './kyc.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KycDocument, User])],
  providers: [KycService, StorageService],
  controllers: [KycController],
  exports: [KycService, StorageService],
})
export class KycModule {}
