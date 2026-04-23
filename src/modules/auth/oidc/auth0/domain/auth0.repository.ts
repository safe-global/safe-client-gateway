// SPDX-License-Identifier: FSL-1.1-MIT
import { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { Auth0Token } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { Auth0TokenResponseSchema } from '@/modules/auth/oidc/auth0/datasources/entities/auth0-token-response.entity';

@Injectable()
export class Auth0Repository implements IAuth0Repository {
  constructor(
    @Inject(IAuth0Api)
    private readonly auth0Api: IAuth0Api,
    private readonly auth0TokenVerifier: Auth0TokenVerifier,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  public getAuthorizationUrl(state: string, connection?: string): string {
    return this.auth0Api.getAuthorizationUrl(state, connection);
  }

  public async authenticateWithAuthorizationCode(
    code: string,
  ): Promise<Auth0Token> {
    const response = await this.auth0Api.exchangeAuthorizationCode(code);
    const { access_token, id_token } = Auth0TokenResponseSchema.parse(response);
    const accessTokenClaims =
      this.auth0TokenVerifier.verifyAndDecodeAccessToken(access_token);

    const emailClaimsFromIdToken = await this.tryGetEmailClaimsFromIdToken(
      id_token,
      accessTokenClaims.sub,
    );
    if (emailClaimsFromIdToken) {
      return { ...accessTokenClaims, ...emailClaimsFromIdToken };
    }

    this.loggingService.debug(
      `Auth0: no usable email claims available in id_token for sub ${accessTokenClaims.sub}`,
    );
    return accessTokenClaims;
  }

  private async tryGetEmailClaimsFromIdToken(
    idToken: string,
    accessTokenSub: string,
  ): Promise<Pick<Auth0Token, 'email' | 'email_verified'> | undefined> {
    try {
      const idTokenClaims =
        await this.auth0TokenVerifier.verifyAndDecodeIdToken(idToken);
      return this.extractEmailClaimsFromIdToken(idTokenClaims, accessTokenSub);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      this.loggingService.debug(
        `Auth0: failed to verify id_token email claims for sub ${accessTokenSub}: ${detail}`,
      );
      return undefined;
    }
  }

  private extractEmailClaimsFromIdToken(
    idTokenClaims: Auth0Token,
    accessTokenSub: string,
  ): Pick<Auth0Token, 'email' | 'email_verified'> | undefined {
    if (idTokenClaims.sub !== accessTokenSub) {
      this.loggingService.warn(
        `Auth0: id_token sub mismatch for access token sub ${accessTokenSub}`,
      );
      return undefined;
    }

    if (
      idTokenClaims.email === undefined &&
      idTokenClaims.email_verified === undefined
    ) {
      this.loggingService.debug(
        `Auth0: id_token has no email claims for sub ${accessTokenSub}`,
      );
      return undefined;
    }
    return {
      email: idTokenClaims.email,
      email_verified: idTokenClaims.email_verified,
    };
  }
}
