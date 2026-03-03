// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  NetworkService,
  type INetworkService,
} from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { TurnstileVerifyResponseSchema } from '@/routes/captcha/entities/turnstile-verify-response.entity';

@Injectable()
export class CaptchaService {
  private readonly verifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  private readonly isEnabled: boolean;
  private readonly secretKey: string;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.isEnabled =
      configurationService.get<boolean>('captcha.enabled') ?? false;
    this.secretKey =
      configurationService.get<string>('captcha.secretKey') ?? '';
  }

  async verifyToken(token: string, remoteip?: string): Promise<boolean> {
    if (!this.isEnabled) {
      return true;
    }

    if (!this.secretKey) {
      this.loggingService.warn(
        'CAPTCHA is enabled but secret key is not configured',
      );
      return false;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await this.networkService.post({
        url: this.verifyUrl,
        data: {
          secret: this.secretKey,
          response: token,
          ...(remoteip && { remoteip }),
        },
      });

      const verifyResponse = TurnstileVerifyResponseSchema.parse(response.data);
      const isValid = verifyResponse.success === true;

      if (!isValid) {
        this.loggingService.debug({
          type: 'captcha_verification_failed',
          errorCodes: verifyResponse['error-codes'] ?? [],
        });
      }

      return isValid;
    } catch (error) {
      this.loggingService.error({
        type: 'captcha_verification_error',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
