import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  ExternalAuthUser,
  IExternalAuthDatasource,
} from '@/modules/auth/datasources/external-auth.datasource.interface';

/**
 * Mock implementation of {@link IExternalAuthDatasource} for development and
 * testing. Points the authorization URL at the CGW-hosted consent page
 * (`GET /v1/auth/mock/consent`) so the full browser redirect flow works
 * without any external dependency.
 *
 * Authorization codes have the format `mock_<url-encoded-email>`, set by the
 * consent page. The special value `invalid` triggers an {@link UnauthorizedException}.
 */
@Injectable()
export class MockExternalAuthDatasource implements IExternalAuthDatasource {
  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  async getOAuthAuthorizationUrl(args: {
    provider: 'google' | 'microsoft';
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    state: string;
  }): Promise<string> {
    const baseUrl = this.configurationService.getOrThrow<string>(
      'externalAuth.mockBaseUrl',
    );
    const params = new URLSearchParams({
      state: args.state,
      client_id: args.clientId,
      redirect_uri: args.redirectUri,
      code_challenge: args.codeChallenge,
      code_challenge_method: args.codeChallengeMethod,
    });
    return `${baseUrl}/v1/auth/mock/consent?${params.toString()}`;
  }

  async exchangeOAuthCode(args: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<ExternalAuthUser> {
    if (args.code === 'invalid') {
      throw new UnauthorizedException('Invalid authorization code');
    }
    const email = args.code.startsWith('mock_')
      ? decodeURIComponent(args.code.slice('mock_'.length))
      : 'mock@example.com';
    return {
      externalId: `mock_${email}`,
      email,
      emailVerified: true,
    };
  }
}
