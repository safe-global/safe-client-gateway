// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AuthModule } from '@/modules/auth/auth.module';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { NotificationsControllerV2 } from '@/modules/notifications/routes/v2/notifications.controller';
import { NotificationsServiceV2 } from '@/modules/notifications/routes/v2/notifications.service';

@Module({
  imports: [NotificationsRepositoryV2Module, AuthModule],
  controllers: [NotificationsControllerV2],
  providers: [NotificationsServiceV2, AuthGuard],
  // Export the controller to enable compatibility with V1.
  exports: [NotificationsServiceV2],
})
export class NotificationsModuleV2 {}
