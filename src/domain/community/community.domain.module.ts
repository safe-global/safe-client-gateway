import { Module } from '@nestjs/common';
import { LockingApiModule } from '@/datasources/locking-api/locking-api.module';
import { ICommunityRepository } from '@/domain/community/community.repository.interface';
import { CommunityRepository } from '@/domain/community/community.repository';

@Module({
  imports: [LockingApiModule],
  providers: [{ provide: ICommunityRepository, useClass: CommunityRepository }],
  exports: [ICommunityRepository],
})
export class CommunityDomainModule {}
