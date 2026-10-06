// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import {
  MCP_SESSION_REQUEST_PROPERTY,
  type McpSession,
} from '@/modules/auth/mcp/domain/entities/mcp-session.entity';
import { getProtectedResourceMetadataUrl } from '@/modules/auth/mcp/routes/utils/protected-resource-metadata.utils';
import { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import { AUTH0_MFA_VERIFIED_AT_CLAIM } from '@/modules/auth/oidc/auth0/domain/entities/auth0-access-token.entity';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { HttpRequest } from '@/routes/common/http/http-request.utils';

declare module 'fastify' {
  interface FastifyRequest {
    [MCP_SESSION_REQUEST_PROPERTY]?: McpSession;
  }
}

/**
 * Admits an MCP request carrying an Auth0 access token issued for the MCP
 * resource, and attaches the caller as an {@link McpSession}.
 *
 * A rejection carries the `WWW-Authenticate` challenge that points the client
 * at the protected resource metadata, which is how an MCP client discovers
 * where to sign the user in (RFC 9728 §5.1).
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  private static readonly BEARER_PREFIX = 'Bearer ';
  private readonly resourceUrl: string;
  private readonly resourceMetadataUrl: string;

  constructor(
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(IAuth0Repository)
    private readonly auth0Repository: IAuth0Repository,
    @Inject(IUsersRepository)
    private readonly usersRepository: IUsersRepository,
  ) {
    this.resourceUrl =
      configurationService.getOrThrow<string>('mcp.resourceUrl');
    this.resourceMetadataUrl = getProtectedResourceMetadataUrl(
      this.resourceUrl,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const reply = http.getResponse<FastifyReply>();

    const accessToken = this.getBearerToken(request.headers.authorization);
    if (!accessToken) {
      throw this.challenge(reply);
    }

    let subject: string;
    let clientId: string | undefined;
    let mfaVerifiedAt: number | undefined;
    let expiresAt: Date | undefined;
    try {
      const token = await this.auth0Repository.verifyAccessToken(
        accessToken,
        this.resourceUrl,
      );
      subject = token.sub;
      clientId = token.azp;
      mfaVerifiedAt = token[AUTH0_MFA_VERIFIED_AT_CLAIM];
      expiresAt = token.exp;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw this.challenge(reply, 'invalid_token');
      }
      throw error;
    }

    // Only users who already signed in to the web app once are admitted: the
    // access token carries no email, so an account cannot be created here.
    const [user] = await this.usersRepository.find({ extUserId: subject });
    if (!user) {
      throw new HttpExceptionNoLog(
        'Sign in to Safe{Wallet} once before connecting',
        HttpStatus.FORBIDDEN,
      );
    }

    request[MCP_SESSION_REQUEST_PROPERTY] = {
      userId: user.id,
      clientId,
      mfaVerifiedAt,
      expiresAt,
    };
    return true;
  }

  private getBearerToken(header: string | undefined): string | undefined {
    if (!header?.startsWith(McpAuthGuard.BEARER_PREFIX)) {
      return undefined;
    }
    return header.slice(McpAuthGuard.BEARER_PREFIX.length).trim() || undefined;
  }

  private challenge(
    reply: FastifyReply,
    error?: 'invalid_token',
  ): HttpExceptionNoLog {
    const parameters = [
      `resource_metadata="${this.resourceMetadataUrl}"`,
      ...(error ? [`error="${error}"`] : []),
    ];
    reply.header('WWW-Authenticate', `Bearer ${parameters.join(', ')}`);
    return new HttpExceptionNoLog('Unauthorized', HttpStatus.UNAUTHORIZED);
  }
}
