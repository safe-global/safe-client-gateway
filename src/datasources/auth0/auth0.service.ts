import { Inject, Injectable } from '@nestjs/common';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IAuth0Service } from '@/datasources/auth0/auth0.service.interface';
import {
  Auth0Token,
  Auth0TokenSchema,
} from '@/datasources/auth0/entities/auth0-token.entity';

@Injectable()
export class Auth0Service implements IAuth0Service {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly signingSecret: string;

  constructor(
    @Inject(IJwtService)
    private readonly jwtService: IJwtService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    const domain =
      this.configurationService.getOrThrow<string>('auth.auth0.domain');
    this.issuer = `https://${domain}/`;

    this.audience = this.configurationService.getOrThrow<string>(
      'auth.auth0.apiIdentifier',
    );
    this.signingSecret = this.configurationService.getOrThrow<string>(
      'auth.auth0.signingSecret',
    );
  }

  public verifyAndDecode(accessToken: string): Auth0Token {
    const decoded = this.jwtService.decode<{ sub: string }>(accessToken, {
      issuer: this.issuer,
      audience: this.audience,
      secretOrPrivateKey: this.signingSecret,
    });
    return Auth0TokenSchema.parse(decoded);
  }
}
