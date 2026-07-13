// SPDX-License-Identifier: FSL-1.1-MIT
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CaptchaService } from '@/routes/captcha/captcha.service';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

@Injectable()
export class CaptchaGuard implements CanActivate {
  private readonly isEnabled: boolean;

  constructor(
    private readonly captchaService: CaptchaService,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
  ) {
    this.isEnabled =
      configurationService.get<boolean>('captcha.enabled') ?? false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.isEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const token = request.headers['x-captcha-token'] as string | undefined;

    if (!token) {
      throw new UnauthorizedException('CAPTCHA token is required');
    }

    const remoteip = request.ip;

    const isValid = await this.captchaService.verifyToken(token, remoteip);

    if (!isValid) {
      throw new UnauthorizedException('Invalid CAPTCHA token');
    }

    return true;
  }
}
