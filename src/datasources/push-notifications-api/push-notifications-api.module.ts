import { CacheModule } from '@/datasources/cache/cache.module';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { JwtModule } from '@/datasources/jwt/jwt.module';
import { FirebaseCloudMessagingApiService } from '@/datasources/push-notifications-api/firebase-cloud-messaging-api.service';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [CacheModule, JwtModule],
  providers: [
    HttpErrorFactory,
    {
      provide: IPushNotificationsApi,
      useClass: FirebaseCloudMessagingApiService,
    },
  ],
  exports: [IPushNotificationsApi],
})
export class PushNotificationsApiModule {}
