import { Module } from '@nestjs/common';
import { CommunityDomainModule } from '@/modules/community/domain/community.domain.module';
import { CommunityService } from '@/modules/community/routes/community.service';
import { CommunityController } from '@/modules/community/routes/community.controller';

@Module({
  imports: [CommunityDomainModule],
  providers: [CommunityService],
  controllers: [CommunityController],
})
export class CommunityModule {}
