// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { HttpAdapterHost } from '@nestjs/core';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthMethod } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { IMcpElevationRepository } from '@/modules/auth/mcp/domain/mcp-elevation.repository.interface';
import {
  ELEVATION_REQUIRED_HINT,
  getStepUpInstruction,
  type McpRequestContext,
  McpToolsService,
} from '@/modules/auth/mcp/routes/mcp-tools.service';
import type { OpenApiCatalogService } from '@/modules/auth/mcp/routes/openapi-catalog.service';
import { ELEVATION_REQUIRED_ERROR } from '@/routes/common/auth/elevation.guard';

const openApiCatalogMock = {
  search: vi.fn(),
  describe: vi.fn(),
  findEndpoint: vi.fn(),
} as unknown as MockedObject<OpenApiCatalogService>;

const authRepositoryMock = {
  signToken: vi.fn(),
} as unknown as MockedObject<IAuthRepository>;

const loggingServiceMock = {
  info: vi.fn(),
} as unknown as MockedObject<ILoggingService>;

const mcpElevationRepositoryMock = {
  createRequest: vi.fn(),
  getElevatedAt: vi.fn(),
} as unknown as MockedObject<IMcpElevationRepository>;

describe('McpToolsService', () => {
  let target: McpToolsService;
  let inject: ReturnType<typeof vi.fn>;
  let context: McpRequestContext;
  let sessionToken: string;
  let gatewayOrigin: string;

  beforeEach(() => {
    vi.resetAllMocks();
    inject = vi.fn();
    const httpAdapterHost = {
      httpAdapter: { getInstance: () => ({ inject }) },
    } as unknown as HttpAdapterHost;
    gatewayOrigin = faker.internet.url({ appendSlash: false });
    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'auth.auth0.redirectUri',
      `${gatewayOrigin}/v1/auth/oidc/callback`,
    );
    context = {
      session: {
        userId: faker.number.int({ min: 1 }),
        clientId: faker.string.alphanumeric(24),
        mfaVerifiedAt: Math.floor(Date.now() / 1_000) - 60,
        expiresAt: faker.date.soon({ days: 1 }),
      },
      clientIp: faker.internet.ipv4(),
    };
    sessionToken = faker.string.alphanumeric(64);
    authRepositoryMock.signToken.mockReturnValue(sessionToken);
    mcpElevationRepositoryMock.getElevatedAt.mockResolvedValue(null);

    target = new McpToolsService(
      httpAdapterHost,
      openApiCatalogMock,
      authRepositoryMock,
      mcpElevationRepositoryMock,
      configurationService,
      loggingServiceMock,
    );
  });

  describe('getTools', () => {
    it('should describe every tool with a JSON schema for its input', () => {
      const tools = target.getTools();

      expect(tools.map((tool) => tool.name)).toEqual([
        'search_endpoints',
        'describe_endpoint',
        'read_endpoint',
        'write_endpoint',
      ]);
      for (const tool of tools) {
        expect(tool.inputSchema).toMatchObject({ type: 'object' });
      }
    });

    it('should only mark the write tool as changing data', () => {
      const tools = target.getTools();

      expect(
        tools
          .filter((tool) => !tool.annotations.readOnlyHint)
          .map((t) => t.name),
      ).toEqual(['write_endpoint']);
    });
  });

  describe('callTool', () => {
    it('should return undefined for an unknown tool', async () => {
      await expect(
        target.callTool(faker.word.noun(), {}, context),
      ).resolves.toBeUndefined();
    });

    it('should report invalid arguments as a tool error', async () => {
      const result = await target.callTool(
        'write_endpoint',
        { method: 'GET', path: '/v1/spaces' },
        context,
      );

      expect(result?.isError).toBe(true);
      expect(inject).not.toHaveBeenCalled();
    });

    it.each([
      '/v1/spaces/../owners',
      'v1/spaces',
      '/v1/spaces?limit=1',
      '/v1/spaces/%2e%2e',
      '/v1//spaces',
    ])('should reject the path %s', async (path) => {
      const result = await target.callTool('read_endpoint', { path }, context);

      expect(result?.isError).toBe(true);
      expect(openApiCatalogMock.findEndpoint).not.toHaveBeenCalled();
    });

    it('should search the catalogue', async () => {
      const endpoints = [{ method: 'GET', path: '/v1/spaces' }];
      openApiCatalogMock.search.mockResolvedValue(
        endpoints as Awaited<ReturnType<OpenApiCatalogService['search']>>,
      );

      const result = await target.callTool(
        'search_endpoints',
        { query: 'spaces' },
        context,
      );

      expect(openApiCatalogMock.search).toHaveBeenCalledWith('spaces');
      expect(JSON.parse(result?.content[0].text ?? '')).toEqual(endpoints);
    });

    it('should report an unknown endpoint when describing one', async () => {
      openApiCatalogMock.describe.mockResolvedValue(undefined);

      const result = await target.callTool(
        'describe_endpoint',
        { method: 'GET', path: '/v1/nothing' },
        context,
      );

      expect(result?.isError).toBe(true);
    });

    it('should not call an endpoint missing from the catalogue', async () => {
      openApiCatalogMock.findEndpoint.mockResolvedValue(undefined);

      const result = await target.callTool(
        'read_endpoint',
        { path: '/v1/unknown' },
        context,
      );

      expect(result?.isError).toBe(true);
      expect(inject).not.toHaveBeenCalled();
    });

    it('should replay a read as the session user', async () => {
      const responseBody = JSON.stringify({ results: [] });
      openApiCatalogMock.findEndpoint.mockResolvedValue({
        method: 'GET',
        path: '/v1/spaces/{id}/members',
      });
      inject.mockResolvedValue({ statusCode: 200, body: responseBody });

      const result = await target.callTool(
        'read_endpoint',
        {
          path: '/v1/spaces/12/members',
          query: { limit: 2, status: ['A', 'B'] },
        },
        context,
      );

      expect(inject).toHaveBeenCalledWith({
        method: 'GET',
        url: '/v1/spaces/12/members?limit=2&status=A&status=B',
        remoteAddress: context.clientIp,
        headers: {
          accept: 'application/json',
          cookie: `access_token=${sessionToken}`,
        },
      });
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        {
          auth_method: AuthMethod.Oidc,
          sub: context.session.userId.toString(),
          mfa_verified_at: context.session.mfaVerifiedAt,
        },
        { iat: expect.any(Date), exp: expect.any(Date) },
      );
      expect(result).toEqual({
        content: [{ type: 'text', text: `HTTP 200\n${responseBody}` }],
        isError: false,
      });
      expect(loggingServiceMock.info).toHaveBeenCalledWith({
        type: 'mcp_tool_call',
        userId: context.session.userId,
        method: 'GET',
        route: '/v1/spaces/{id}/members',
        statusCode: 200,
      });
    });

    it('should send a write body as JSON', async () => {
      const body = { name: faker.company.name() };
      openApiCatalogMock.findEndpoint.mockResolvedValue({
        method: 'POST',
        path: '/v1/spaces',
      });
      inject.mockResolvedValue({ statusCode: 201, body: '{}' });

      await target.callTool(
        'write_endpoint',
        { method: 'POST', path: '/v1/spaces', body },
        context,
      );

      expect(inject).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/v1/spaces',
          payload: JSON.stringify(body),
          headers: expect.objectContaining({
            'content-type': 'application/json',
          }),
        }),
      );
    });

    it('should not let the session token outlive the access token', async () => {
      const expiresAt = new Date(Date.now() + 5_000);
      context.session.expiresAt = expiresAt;
      openApiCatalogMock.findEndpoint.mockResolvedValue({
        method: 'GET',
        path: '/v1/spaces',
      });
      inject.mockResolvedValue({ statusCode: 200, body: '[]' });

      await target.callTool('read_endpoint', { path: '/v1/spaces' }, context);

      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ exp: expiresAt }),
      );
    });

    describe('step-up', () => {
      beforeEach(() => {
        openApiCatalogMock.findEndpoint.mockResolvedValue({
          method: 'DELETE',
          path: '/v1/spaces/{id}',
        });
        inject.mockResolvedValue({
          statusCode: 403,
          body: JSON.stringify({
            statusCode: 403,
            message: ELEVATION_REQUIRED_ERROR,
          }),
        });
      });

      it('should hand the model a step-up link for this connection', async () => {
        const requestId = faker.string.hexadecimal({
          length: 64,
          casing: 'lower',
          prefix: '',
        });
        mcpElevationRepositoryMock.createRequest.mockResolvedValue(requestId);

        const result = await target.callTool(
          'write_endpoint',
          { method: 'DELETE', path: '/v1/spaces/12' },
          context,
        );

        expect(mcpElevationRepositoryMock.createRequest).toHaveBeenCalledWith({
          userId: context.session.userId,
          clientId: context.session.clientId,
        });
        expect(result?.isError).toBe(true);
        expect(result?.content[0].text).toContain(
          getStepUpInstruction(
            `${gatewayOrigin}/v1/auth/oidc/authorize?mcp_elevation=${requestId}`,
          ),
        );
      });

      it('should fall back to reconnecting when the token names no client', async () => {
        context.session.clientId = undefined;

        const result = await target.callTool(
          'write_endpoint',
          { method: 'DELETE', path: '/v1/spaces/12' },
          context,
        );

        expect(mcpElevationRepositoryMock.createRequest).not.toHaveBeenCalled();
        expect(result?.content[0].text).toContain(ELEVATION_REQUIRED_HINT);
      });

      it('should not open a step-up for another 403', async () => {
        inject.mockResolvedValue({
          statusCode: 403,
          body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
        });

        await target.callTool(
          'write_endpoint',
          { method: 'DELETE', path: '/v1/spaces/12' },
          context,
        );

        expect(mcpElevationRepositoryMock.createRequest).not.toHaveBeenCalled();
      });
    });

    it('should sign the session with a step-up completed after sign-in', async () => {
      const elevatedAt = Math.floor(Date.now() / 1_000);
      mcpElevationRepositoryMock.getElevatedAt.mockResolvedValue(elevatedAt);
      openApiCatalogMock.findEndpoint.mockResolvedValue({
        method: 'GET',
        path: '/v1/spaces',
      });
      inject.mockResolvedValue({ statusCode: 200, body: '[]' });

      await target.callTool('read_endpoint', { path: '/v1/spaces' }, context);

      expect(mcpElevationRepositoryMock.getElevatedAt).toHaveBeenCalledWith({
        userId: context.session.userId,
        clientId: context.session.clientId,
      });
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.objectContaining({ mfa_verified_at: elevatedAt }),
        expect.anything(),
      );
    });

    it('should leave the session without a second factor when there was none', async () => {
      context.session.mfaVerifiedAt = undefined;
      openApiCatalogMock.findEndpoint.mockResolvedValue({
        method: 'GET',
        path: '/v1/spaces',
      });
      inject.mockResolvedValue({ statusCode: 200, body: '[]' });

      await target.callTool('read_endpoint', { path: '/v1/spaces' }, context);

      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.objectContaining({ mfa_verified_at: undefined }),
        expect.anything(),
      );
    });

    it('should truncate a very large response', async () => {
      openApiCatalogMock.findEndpoint.mockResolvedValue({
        method: 'GET',
        path: '/v1/spaces',
      });
      inject.mockResolvedValue({ statusCode: 200, body: 'x'.repeat(150_000) });

      const result = await target.callTool(
        'read_endpoint',
        { path: '/v1/spaces' },
        context,
      );

      expect(result?.content[0].text.length).toBeLessThan(101_000);
      expect(result?.content[0].text).toContain('[Truncated');
    });
  });
});
