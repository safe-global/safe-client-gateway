import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CaptchaService } from '@/routes/captcha/captcha.service';
import { IConfigurationService } from '@/config/configuration.service.interface';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private readonly captchaService: CaptchaService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isEnabled = this.configurationService.get<boolean>('captcha.enabled');
    if (!isEnabled) {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
    const token = request.headers['x-captcha-token'] as string | undefined;

    if (!token) {
      throw new UnauthorizedException('CAPTCHA token is required');
    }

    const remoteip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      request.socket.remoteAddress;

    const isValid = await this.captchaService.verifyToken(token, remoteip);

    if (!isValid) {
      throw new UnauthorizedException('Invalid CAPTCHA token');
    }

    return true;
  }
}
