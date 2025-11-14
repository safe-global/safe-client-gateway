import { Module } from '@nestjs/common';
import { LockingApiModule } from '@/datasources/locking-api/locking-api.module';
import { ICommunityRepository } from '@/modules/community/domain/community.repository.interface';
import { CommunityRepository } from '@/modules/community/domain/community.repository';
import { IdentityApiModule } from '@/datasources/locking-api/identity-api.module';

@Module({
  imports: [LockingApiModule, IdentityApiModule],
  providers: [{ provide: ICommunityRepository, useClass: CommunityRepository }],
  exports: [ICommunityRepository],
})
export class CommunityDomainModule {}
