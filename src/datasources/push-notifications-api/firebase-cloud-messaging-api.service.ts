import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IPushNotificationsApi } from '@/domain/interfaces/push-notifications-api.interface';
import { Inject, Injectable } from '@nestjs/common';
import {
  FirebaseAndroidMessageConfig,
  FireabaseNotificationApn,
  FirebaseNotification,
  NotificationContent,
} from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import {
  FirebaseOauth2Token,
  FirebaseOauth2TokenSchema,
} from '@/datasources/push-notifications-api/entities/firebase-oauth2-token.entity';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getFirstAvailable } from '@/domain/common/utils/array';

@Injectable()
export class FirebaseCloudMessagingApiService implements IPushNotificationsApi {
  private static readonly OAuth2TokenUrl =
    'https://oauth2.googleapis.com/token';
  private static readonly OAuth2TokenTtlBufferInSeconds = 5;
  private static readonly Scope =
    'https://www.googleapis.com/auth/firebase.messaging';

  private static readonly DefaultIosNotificationTitle = 'New Activity';
  private static readonly DefaultIosNotificationBody =
    'New Activity with your Safe';

  private static readonly ERROR_ARRAY_PATH = [
    'data.error_description',
    'data.error.message',
  ];

  private readonly baseUrl: string;
  private readonly project: string;
  private readonly clientEmail: string;
  private readonly privateKey: string;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
  ) {
    this.baseUrl = this.configurationService.getOrThrow<string>(
      'pushNotifications.baseUri',
    );
    this.project = this.configurationService.getOrThrow<string>(
      'pushNotifications.project',
    );
    // Service account credentials are used for OAuth2 assertion
    this.clientEmail = this.configurationService.getOrThrow<string>(
      'pushNotifications.serviceAccount.clientEmail',
    );
    this.privateKey = this.configurationService.getOrThrow<string>(
      'pushNotifications.serviceAccount.privateKey',
    );
  }

  /**
   * Returns the notification data for iOS devices.
   *
   * On iOS, a title and body are required for a notification to be displayed.
   * The `mutable-content` field is set to `1` to allow the notification to be modified by the app.
   *      This ensures an appropriate title and body are displayed to the user.
   *
   * @param {NotificationContent} notification - notification payload
   *
   * @returns {FireabaseNotificationApn} - iOS notification data
   **/
  private getIosNotificationData(
    notification?: NotificationContent,
  ): FireabaseNotificationApn {
    return {
      apns: {
        payload: {
          aps: {
            alert: {
              title:
                notification?.title ??
                FirebaseCloudMessagingApiService.DefaultIosNotificationTitle,
              body:
                notification?.body ??
                FirebaseCloudMessagingApiService.DefaultIosNotificationBody,
            },
            'mutable-content': 1,
          },
        },
      },
    };
  }

  /**
   * Returns the Android message config for the notification.
   *
   * @returns {FirebaseAndroidMessageConfig} - Android message config
   **/
  private getAndroidMessageConfig(): FirebaseAndroidMessageConfig {
    return {
      android: { priority: 'high' },
    };
  }

  /**
   * Enqueues a notification to be sent to a device with given FCM token.
   *
   * @param fcmToken - device's FCM token
   * @param notification - notification payload
   */
  async enqueueNotification(
    fcmToken: string,
    notification: FirebaseNotification,
  ): Promise<void> {
    const url = `${this.baseUrl}/${this.project}/messages:send`;
    try {
      const accessToken = await this.getOauth2Token();
      await this.networkService.post({
        url,
        data: {
          message: {
            token: fcmToken,
            ...notification,
            ...this.getIosNotificationData(notification.notification),
            ...this.getAndroidMessageConfig(),
          },
        },
        networkRequest: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
    } catch (error) {
      /**
       * @todo Handle error properly
       *
       * We should consider NotificationRespository when handling errors because the logic is parially handled there.
       */
      throw this.mapError(error);
    }
  }

  /**
   * Retrieves and caches OAuth2 token for Firebase Cloud Messaging API.
   *
   * @returns - OAuth2 token
   */
  // TODO: Use CacheFirstDataSource
  private async getOauth2Token(): Promise<string> {
    const cacheDir = CacheRouter.getFirebaseOAuth2TokenCacheDir();
    const cachedToken = await this.cacheService.hGet(cacheDir);

    if (cachedToken) {
      return cachedToken;
    }

    const data = await this.networkService
      .post<FirebaseOauth2Token>({
        url: FirebaseCloudMessagingApiService.OAuth2TokenUrl,
        data: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: this.getAssertion(),
        },
      })
      .then((response) => FirebaseOauth2TokenSchema.parse(response.data));

    // Token cached according to issuance
    await this.cacheService.hSet(
      cacheDir,
      data.access_token,
      // Buffer ensures token is not cached beyond expiration if caching took time
      data.expires_in -
        FirebaseCloudMessagingApiService.OAuth2TokenTtlBufferInSeconds,
    );

    return data.access_token;
  }

  /**
   * Generates a signed JWT assertion for OAuth2 token request.
   *
   * @returns - signed JWT assertion
   */
  private getAssertion(): string {
    const now = new Date();

    const payload = {
      iss: this.clientEmail,
      scope: FirebaseCloudMessagingApiService.Scope,
      aud: FirebaseCloudMessagingApiService.OAuth2TokenUrl,
      iat: now,
      // Maximum expiration time is 1 hour
      exp: new Date(now.getTime() + 60 * 60 * 1_000),
    };

    return this.jwtService.sign(payload, {
      secretOrPrivateKey: this.privateKey,
      algorithm: 'RS256',
    });
  }

  private mapError(error: unknown): unknown {
    if (error instanceof NetworkResponseError) {
      const errorMessage = getFirstAvailable(
        error,
        FirebaseCloudMessagingApiService.ERROR_ARRAY_PATH,
      );

      if (errorMessage) {
        return new Error(errorMessage);
      }
    }

    return error;
  }
}
