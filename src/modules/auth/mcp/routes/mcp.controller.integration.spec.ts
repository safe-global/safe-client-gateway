// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MockedObject, MockInstance } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import configuration from '@/config/entities/__tests__/configuration';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { ELEVATION_REQUIRED_HINT } from '@/modules/auth/mcp/routes/mcp-tools.service';
import {
  type Auth0JwksFixture,
  getAuth0JwksFixture,
  mockAuth0Jwks,
  signAuth0Jwt,
} from '@/modules/auth/oidc/auth0/__tests__/auth0-jwks.helper';
import { AUTH0_MFA_VERIFIED_AT_CLAIM } from '@/modules/auth/oidc/auth0/domain/entities/auth0-access-token.entity';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { rawify } from '@/validation/entities/raw.entity';
import { fakeEmailAddress } from '@/validation/entities/schemas/__tests__/email-address.builder';

describe('McpController', () => {
  let app: INestApplication<Server>;
  let fetchMock: MockInstance<typeof fetch>;
  let jwks: Auth0JwksFixture;
  let issuer: string;
  let extUserId: string;
  let networkService: MockedObject<INetworkService>;

  const defaultConfiguration = configuration();
  const resourceUrl = `${faker.internet.url({ appendSlash: false })}/v1/mcp`;

  beforeAll(async () => {
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        users: true,
        oidc_auth: true,
        mcp: true,
        mfaStepUp: true,
      },
      mcp: { resourceUrl },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    issuer = `https://${defaultConfiguration.auth.auth0.domain}/`;
    networkService = moduleFixture.get(NetworkService);
    jwks = getAuth0JwksFixture();
    extUserId = `auth0|${faker.string.uuid()}`;

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);

    await moduleFixture
      .get<IUsersRepository>(IUsersRepository)
      .findOrCreateByExtUserIdAndEmail(extUserId, fakeEmailAddress());
  });

  beforeEach(() => {
    fetchMock = vi.spyOn(global, 'fetch');
    mockAuth0Jwks({
      fetchMock,
      issuer,
      publicJwk: jwks.publicJwk,
      kid: jwks.kid,
    });
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  afterAll(async () => {
    await app.close();
  });

  const accessToken = (claims: object = {}): string =>
    signAuth0Jwt({
      issuer,
      audience: resourceUrl,
      kid: jwks.kid,
      privateKey: jwks.privateKey,
      payload: { sub: extUserId, ...claims },
    });

  const rpc = (
    method: string,
    params: object,
    token = accessToken(),
  ): request.Test =>
    request(app.getHttpServer())
      .post('/v1/mcp')
      .set('Authorization', `Bearer ${token}`)
      .send({ jsonrpc: '2.0', id: faker.number.int(), method, params });

  const callTool = async (
    name: string,
    args: object,
    token?: string,
  ): Promise<{ text: string; isError: boolean }> => {
    const response = await rpc(
      'tools/call',
      { name, arguments: args },
      token,
    ).expect(200);
    return {
      text: response.body.result.content[0].text,
      isError: response.body.result.isError === true,
    };
  };

  it('should publish the protected resource metadata', async () => {
    await request(app.getHttpServer())
      .get('/.well-known/oauth-protected-resource/v1/mcp')
      .expect(200)
      .expect({
        resource: resourceUrl,
        authorization_servers: [issuer],
        bearer_methods_supported: ['header'],
      });
  });

  it('should challenge a request without an access token', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'ping' })
      .expect(401);

    expect(response.headers['www-authenticate']).toBe(
      `Bearer resource_metadata="${new URL(resourceUrl).origin}/.well-known/oauth-protected-resource/v1/mcp"`,
    );
  });

  it('should reject an access token issued for another audience', async () => {
    const token = signAuth0Jwt({
      issuer,
      audience: faker.internet.url(),
      kid: jwks.kid,
      privateKey: jwks.privateKey,
      payload: { sub: extUserId },
    });

    await rpc('ping', {}, token).expect(401);
  });

  it('should initialize', async () => {
    const response = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    }).expect(200);

    expect(response.body.result).toMatchObject({
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
    });
  });

  it('should accept a notification without a response', async () => {
    await request(app.getHttpServer())
      .post('/v1/mcp')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({ jsonrpc: '2.0', method: 'notifications/initialized' })
      .expect(202);
  });

  it('should find endpoints in the OpenAPI document', async () => {
    const { text } = await callTool('search_endpoints', { query: 'spaces' });

    expect(JSON.parse(text)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', path: '/v1/spaces' }),
      ]),
    );
    expect(text).not.toContain('/v1/mcp');
  });

  it('should create and read a Workspace as the signed-in user', async () => {
    const name = nameBuilder();

    const created = await callTool('write_endpoint', {
      method: 'POST',
      path: '/v1/spaces',
      body: { name },
    });
    expect(created.isError).toBe(false);
    expect(created.text).toMatch(/^HTTP 201\n/);

    const listed = await callTool('read_endpoint', { path: '/v1/spaces' });
    expect(listed.isError).toBe(false);
    expect(listed.text).toContain(name);
  });

  it('should ask for a step-up when a gated action lacks a fresh second factor', async () => {
    const created = await callTool('write_endpoint', {
      method: 'POST',
      path: '/v1/spaces',
      body: { name: nameBuilder() },
    });
    const spaceId = JSON.parse(created.text.split('\n')[1]).uuid;

    const deleted = await callTool('write_endpoint', {
      method: 'DELETE',
      path: `/v1/spaces/${spaceId}`,
    });

    expect(deleted.isError).toBe(true);
    expect(deleted.text).toContain(ELEVATION_REQUIRED_HINT);
  });

  it('should complete a step-up through the link without touching the browser session', async () => {
    const connectionToken = accessToken({ azp: faker.string.alphanumeric(24) });
    const created = await callTool(
      'write_endpoint',
      { method: 'POST', path: '/v1/spaces', body: { name: nameBuilder() } },
      connectionToken,
    );
    const spaceId = JSON.parse(created.text.split('\n')[1]).uuid;
    const deleteSpace = {
      method: 'DELETE',
      path: `/v1/spaces/${spaceId}`,
    };

    const refused = await callTool(
      'write_endpoint',
      deleteSpace,
      connectionToken,
    );
    expect(refused.isError).toBe(true);
    const link = new URL(
      refused.text.match(/\S+mcp_elevation=[0-9a-f]{64}/)?.[0] ?? '',
    );

    const authorize = await request(app.getHttpServer())
      .get(`${link.pathname}${link.search}`)
      .expect(302);
    const state = new URL(authorize.headers.location).searchParams.get('state');
    const stateCookie = (
      authorize.headers['set-cookie'] as unknown as Array<string>
    )
      .find((cookie) => cookie.startsWith('auth_state='))
      ?.split(';')[0];
    networkService.postForm.mockResolvedValueOnce({
      status: 200,
      data: rawify({
        access_token: faker.string.alphanumeric(64),
        id_token: signAuth0Jwt({
          issuer,
          audience: defaultConfiguration.auth.auth0.clientId ?? '',
          kid: jwks.kid,
          privateKey: jwks.privateKey,
          payload: { sub: extUserId, amr: ['mfa'] },
        }),
        token_type: 'Bearer',
      }),
    });

    const callback = await request(app.getHttpServer())
      .get('/v1/auth/oidc/callback')
      .set('Cookie', stateCookie ?? '')
      .query({ code: faker.string.alphanumeric(16), state })
      .expect(200);
    expect(callback.text).toContain('Second factor confirmed');
    expect(callback.headers['set-cookie']).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^access_token=/)]),
    );

    const retried = await callTool(
      'write_endpoint',
      deleteSpace,
      connectionToken,
    );
    expect(retried.isError).toBe(false);
  });

  it('should allow a gated action after a recent second factor', async () => {
    const elevatedToken = accessToken({
      [AUTH0_MFA_VERIFIED_AT_CLAIM]: Math.floor(Date.now() / 1_000),
    });
    const created = await callTool(
      'write_endpoint',
      { method: 'POST', path: '/v1/spaces', body: { name: nameBuilder() } },
      elevatedToken,
    );
    const spaceId = JSON.parse(created.text.split('\n')[1]).uuid;

    const deleted = await callTool(
      'write_endpoint',
      { method: 'DELETE', path: `/v1/spaces/${spaceId}` },
      elevatedToken,
    );

    expect(deleted.isError).toBe(false);
  });
});
