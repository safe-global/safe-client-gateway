import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '../../../config/configuration.service.interface';

@Injectable()
export class AuthService {
  private static readonly AUTH_PREFIX = 'Basic ';

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  validateAuthToken(authorization: string | null): boolean {
    return (
      !!authorization &&
      authorization.includes(AuthService.AUTH_PREFIX) &&
      authorization.split(AuthService.AUTH_PREFIX)[1] ===
        this.configurationService.getOrThrow<string>('auth.token')
    );
  }
}
