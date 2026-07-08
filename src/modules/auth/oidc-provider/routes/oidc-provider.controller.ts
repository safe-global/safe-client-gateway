// SPDX-License-Identifier: FSL-1.1-MIT
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Res,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  type AuthorizeQuery,
  AuthorizeQuerySchema,
  OidcSignInDto,
  OidcSignInDtoSchema,
  TokenRequestDto,
  TokenRequestDtoSchema,
} from '@/modules/auth/oidc-provider/routes/entities/oidc-provider.dto.entity';
import { OidcProviderService } from '@/modules/auth/oidc-provider/routes/oidc-provider.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';

/**
 * The OidcProviderController exposes CGW as an OAuth 2.0/OIDC identity
 * provider backed by Sign-in with Ethereum (akin to
 * {@link https://github.com/spruceid/siwe-oidc}), e.g. for use as an
 * Auth0 custom social connection:
 *
 * 1. The client (e.g. Auth0) sends the browser to `/v1/oauth2/authorize`,
 *    which redirects to the Safe{Wallet} sign-in page with a SiWe nonce.
 * 2. The user signs the SiWe message; the page POSTs it to
 *    `/v1/oauth2/signin` which validates it (same code path as
 *    `/v1/auth/verify`) and returns the client redirect with a code.
 * 3. The client exchanges the code at `/v1/oauth2/token` and can fetch
 *    the user profile from `/v1/oauth2/userinfo`.
 */
@ApiTags('auth')
@Controller()
export class OidcProviderController {
  constructor(private readonly oidcProviderService: OidcProviderService) {}

  @ApiOperation({ summary: 'OIDC discovery document' })
  @ApiOkResponse({ description: 'OpenID Provider configuration' })
  @Version(VERSION_NEUTRAL)
  @Get('.well-known/openid-configuration')
  getDiscoveryDocument(): Record<string, unknown> {
    return this.oidcProviderService.getDiscoveryDocument();
  }

  @ApiOperation({
    summary: 'OAuth 2.0 authorization endpoint',
    description:
      'Validates the authorization request and redirects the browser to the Sign-in with Ethereum page.',
  })
  @ApiFoundResponse({ description: 'Redirect to the sign-in page' })
  @Version('1')
  @Get('oauth2/authorize')
  async authorize(
    @Res({ passthrough: true }) res: Response,
    @Query(new ValidationPipe(AuthorizeQuerySchema)) query: AuthorizeQuery,
  ): Promise<void> {
    const signInUrl =
      await this.oidcProviderService.createAuthorizationRequest(query);
    res.redirect(signInUrl);
  }

  @ApiOperation({
    summary: 'Complete Sign-in with Ethereum',
    description:
      'Verifies the signed SiWe message, issues an authorization code and returns the URL to redirect the browser back to the client.',
  })
  @ApiBody({ type: OidcSignInDto })
  @ApiOkResponse({ description: 'Redirect URL containing the code' })
  @HttpCode(200)
  @Version('1')
  @Post('oauth2/signin')
  signIn(
    @Body(new ValidationPipe(OidcSignInDtoSchema)) dto: OidcSignInDto,
  ): Promise<{ redirect_url: string }> {
    return this.oidcProviderService.signIn(dto);
  }

  @ApiOperation({
    summary: 'OAuth 2.0 token endpoint',
    description:
      'Exchanges a single-use authorization code for an access and ID token.',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ type: TokenRequestDto })
  @ApiOkResponse({ description: 'Access and ID token' })
  @HttpCode(200)
  @Version('1')
  @Post('oauth2/token')
  getToken(
    @Body(new ValidationPipe(TokenRequestDtoSchema)) dto: TokenRequestDto,
    @Headers('authorization') authorization?: string,
  ): ReturnType<OidcProviderService['getToken']> {
    return this.oidcProviderService.getToken(dto, authorization);
  }

  @ApiOperation({
    summary: 'OIDC userinfo endpoint',
    description:
      'Returns the signer address of the Bearer access token holder.',
  })
  @ApiOkResponse({ description: 'User profile' })
  @Version('1')
  @Get('oauth2/userinfo')
  getUserInfo(
    @Headers('authorization') authorization?: string,
  ): ReturnType<OidcProviderService['getUserInfo']> {
    return this.oidcProviderService.getUserInfo(authorization);
  }
}
