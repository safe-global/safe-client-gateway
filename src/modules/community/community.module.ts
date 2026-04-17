// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IdentityApiModule } from '@/datasources/locking-api/identity-api.module';
import { LockingApiModule } from '@/datasources/locking-api/locking-api.module';
import { CommunityRepository } from '@/modules/community/domain/community.repository';
import { ICommunityRepository } from '@/modules/community/domain/community.repository.interface';
import { CommunityController } from '@/modules/community/routes/community.controller';
import { CommunityService } from '@/modules/community/routes/community.service';

@Module({
  imports: [LockingApiModule, IdentityApiModule],
  providers: [
    { provide: ICommunityRepository, useClass: CommunityRepository },
    CommunityService,
  ],
  controllers: [CommunityController],
  exports: [ICommunityRepository],
})
export class CommunityModule {}
