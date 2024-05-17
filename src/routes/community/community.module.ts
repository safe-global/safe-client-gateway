import { Module } from '@nestjs/common';
import { LockingDomainModule } from '@/domain/locking/locking.domain.module';
import { CommunityService } from '@/routes/community/community.service';
import { CommunityController } from '@/routes/community/community.controller';

@Module({
  imports: [LockingDomainModule],
  providers: [CommunityService],
  controllers: [CommunityController],
})
export class CommunityModule {}
