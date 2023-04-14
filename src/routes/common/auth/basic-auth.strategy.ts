import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from './auth-service';

@Injectable()
export class BasicAuthStrategy extends PassportStrategy(
  Strategy,
  'basic-auth',
) {
  constructor(private authService: AuthService) {
    super();
  }

  validate(req: Request): any {
    const isAuthorized = this.authService.validateAuthToken(
      req.headers['authorization'] ?? null,
    );

    if (!isAuthorized) {
      throw new UnauthorizedException();
    }
    return isAuthorized;
  }
}
