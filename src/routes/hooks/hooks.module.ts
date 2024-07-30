import { Module } from '@nestjs/common';
import { HooksController } from '@/routes/hooks/hooks.controller';
import {
  HooksRepositoryModule,
  HooksRepositoryWithNotificationsModule,
} from '@/domain/hooks/hooks.repository.interface';
import { HooksService } from '@/routes/hooks/hooks.service';

@Module({
  imports: [HooksRepositoryWithNotificationsModule],
  providers: [HooksService],
  controllers: [HooksController],
})
export class HooksModuleWithNotifications {}

// TODO: Remove after notifications FF is enabled
// Note: trying to convert this into a dynamic module proved to be too complex
// due to config injection issues from the ConfigurationService so this is a
// temporary solution
@Module({
  imports: [HooksRepositoryModule],
  providers: [HooksService],
  controllers: [HooksController],
})
export class HooksModule {}
