import { Module } from '@nestjs/common';
import { CommunityDomainModule } from '@/domain/community/community.domain.module';
import { CommunityService } from '@/routes/community/community.service';
import { CommunityController } from '@/routes/community/community.controller';

@Module({
  imports: [CommunityDomainModule],
  providers: [CommunityService],
  controllers: [CommunityController],
})
export class CommunityModule {}
