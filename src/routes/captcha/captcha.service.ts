// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  NetworkService,
  type INetworkService,
} from '@/datasources/network/network.service.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { TurnstileVerifyResponseSchema } from '@/routes/captcha/entities/turnstile-verify-response.entity';
import { asError } from '@/logging/utils';
import { LogType } from '@/domain/common/entities/log-type.entity';

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

    if (this.isEnabled && !this.secretKey) {
      throw new Error('CAPTCHA is enabled but secret key is not configured');
    }
  }

  async verifyToken(token: string, remoteip?: string): Promise<boolean> {
    if (!this.isEnabled) {
      return true;
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
          type: LogType.CaptchaVerificationFailed,
          errorCodes: verifyResponse['error-codes'] ?? [],
        });
      }

      return isValid;
    } catch (error) {
      this.loggingService.error({
        type: LogType.CaptchaVerificationError,
        error: asError(error).message,
      });
      return false;
    }
  }
}
