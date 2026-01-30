import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  NetworkService,
  type INetworkService,
} from '@/datasources/network/network.service.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: Array<string>;
  challenge_ts?: string;
  hostname?: string;
}

@Injectable()
export class CaptchaService {
  private readonly verifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async verifyToken(token: string, remoteip?: string): Promise<boolean> {
    const isEnabled = this.configurationService.get<boolean>('captcha.enabled');
    if (!isEnabled) {
      return true;
    }

    const secretKey =
      this.configurationService.get<string>('captcha.secretKey');
    if (!secretKey) {
      this.loggingService.warn(
        'CAPTCHA is enabled but secret key is not configured',
      );
      return false;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await this.networkService.post<TurnstileVerifyResponse>({
        url: this.verifyUrl,
        data: {
          secret: secretKey,
          response: token,
          ...(remoteip && { remoteip }),
        },
      });

      // response.data is Raw<TurnstileVerifyResponse>, cast to actual type
      const verifyResponse =
        response.data as unknown as TurnstileVerifyResponse;
      const isValid = verifyResponse?.success === true;

      if (!isValid) {
        this.loggingService.debug({
          type: 'captcha_verification_failed',
          errorCodes: verifyResponse?.['error-codes'] || [],
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
