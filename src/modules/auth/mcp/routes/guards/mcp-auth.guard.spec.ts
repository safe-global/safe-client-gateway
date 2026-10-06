// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  type ExecutionContext,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { toSecondsTimestamp } from '@/domain/common/utils/time';
import {
  MCP_SESSION_REQUEST_PROPERTY,
  type McpSession,
} from '@/modules/auth/mcp/domain/entities/mcp-session.entity';
import { McpAuthGuard } from '@/modules/auth/mcp/routes/guards/mcp-auth.guard';
import type { IAuth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository.interface';
import { AUTH0_MFA_VERIFIED_AT_CLAIM } from '@/modules/auth/oidc/auth0/domain/entities/auth0-access-token.entity';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { User as DbUser } from '@/modules/users/datasources/entities/users.entity.db';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';

const auth0RepositoryMock = {
  verifyAccessToken: vi.fn(),
} as unknown as MockedObject<IAuth0Repository>;

const usersRepositoryMock = {
  find: vi.fn(),
} as unknown as MockedObject<IUsersRepository>;

describe('McpAuthGuard', () => {
  let target: McpAuthGuard;
  let resourceUrl: string;
  let request: {
    headers: { authorization?: string };
    [MCP_SESSION_REQUEST_PROPERTY]?: McpSession;
  };
  let reply: { header: ReturnType<typeof vi.fn> };

  const buildContext = (): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => reply,
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.resetAllMocks();
    resourceUrl = `${faker.internet.url({ appendSlash: false })}/v1/mcp`;
    const configurationService = new FakeConfigurationService();
    configurationService.set('mcp.resourceUrl', resourceUrl);
    request = { headers: {} };
    reply = { header: vi.fn() };

    target = new McpAuthGuard(
      configurationService,
      auth0RepositoryMock,
      usersRepositoryMock,
    );
  });

  it('should attach the session of a user with a valid access token', async () => {
    const accessToken = faker.string.alphanumeric(64);
    const extUserId = `auth0|${faker.string.uuid()}`;
    const mfaVerifiedAt = toSecondsTimestamp(faker.date.recent());
    const expiresAt = faker.date.soon();
    const clientId = faker.string.alphanumeric(24);
    const user = userBuilder().with('extUserId', extUserId).build();
    request.headers.authorization = `Bearer ${accessToken}`;
    auth0RepositoryMock.verifyAccessToken.mockResolvedValue({
      sub: extUserId,
      azp: clientId,
      exp: expiresAt,
      [AUTH0_MFA_VERIFIED_AT_CLAIM]: mfaVerifiedAt,
    } as Awaited<ReturnType<IAuth0Repository['verifyAccessToken']>>);
    usersRepositoryMock.find.mockResolvedValue([user as DbUser]);

    await expect(target.canActivate(buildContext())).resolves.toBe(true);

    expect(auth0RepositoryMock.verifyAccessToken).toHaveBeenCalledWith(
      accessToken,
      resourceUrl,
    );
    expect(usersRepositoryMock.find).toHaveBeenCalledWith({ extUserId });
    expect(request[MCP_SESSION_REQUEST_PROPERTY]).toEqual({
      userId: user.id,
      clientId,
      mfaVerifiedAt,
      expiresAt,
    });
  });

  it('should challenge a request without a bearer token', async () => {
    await expect(target.canActivate(buildContext())).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });

    const metadataUrl = `${new URL(resourceUrl).origin}/.well-known/oauth-protected-resource/v1/mcp`;
    expect(reply.header).toHaveBeenCalledWith(
      'WWW-Authenticate',
      `Bearer resource_metadata="${metadataUrl}"`,
    );
    expect(auth0RepositoryMock.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('should challenge a request with another authorization scheme', async () => {
    request.headers.authorization = `Basic ${faker.string.alphanumeric(24)}`;

    await expect(target.canActivate(buildContext())).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(auth0RepositoryMock.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('should challenge an invalid access token with error="invalid_token"', async () => {
    request.headers.authorization = `Bearer ${faker.string.alphanumeric(64)}`;
    auth0RepositoryMock.verifyAccessToken.mockRejectedValue(
      new UnauthorizedException('Invalid access token'),
    );

    await expect(target.canActivate(buildContext())).rejects.toMatchObject({
      status: HttpStatus.UNAUTHORIZED,
    });
    expect(reply.header).toHaveBeenCalledWith(
      'WWW-Authenticate',
      expect.stringContaining('error="invalid_token"'),
    );
    expect(request[MCP_SESSION_REQUEST_PROPERTY]).toBeUndefined();
  });

  it('should rethrow errors other than a failed verification', async () => {
    const error = new Error('JWKS unavailable');
    request.headers.authorization = `Bearer ${faker.string.alphanumeric(64)}`;
    auth0RepositoryMock.verifyAccessToken.mockRejectedValue(error);

    await expect(target.canActivate(buildContext())).rejects.toBe(error);
    expect(reply.header).not.toHaveBeenCalled();
  });

  it('should reject a user who never signed in to the web app', async () => {
    request.headers.authorization = `Bearer ${faker.string.alphanumeric(64)}`;
    auth0RepositoryMock.verifyAccessToken.mockResolvedValue({
      sub: `auth0|${faker.string.uuid()}`,
    } as Awaited<ReturnType<IAuth0Repository['verifyAccessToken']>>);
    usersRepositoryMock.find.mockResolvedValue([]);

    await expect(target.canActivate(buildContext())).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(request[MCP_SESSION_REQUEST_PROPERTY]).toBeUndefined();
  });
});
