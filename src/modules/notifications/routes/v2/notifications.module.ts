import { Module } from '@nestjs/common';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth.repository.interface';
import { NotificationsServiceV2 } from '@/modules/notifications/routes/v2/notifications.service';
import { NotificationsControllerV2 } from '@/modules/notifications/routes/v2/notifications.controller';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';

@Module({
  imports: [NotificationsRepositoryV2Module, AuthRepositoryModule],
  controllers: [NotificationsControllerV2],
  providers: [NotificationsServiceV2, AuthGuard],
  // Export the controller to enable compatibility with V1.
  exports: [NotificationsServiceV2],
})
export class NotificationsModuleV2 {}
