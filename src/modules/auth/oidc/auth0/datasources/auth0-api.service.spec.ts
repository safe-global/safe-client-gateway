// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { Auth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.service';
import { rawify } from '@/validation/entities/raw.entity';

const networkService = {
  delete: vi.fn(),
  get: vi.fn(),
  postForm: vi.fn(),
} as MockedObject<INetworkService>;

describe('Auth0Api', () => {
  let target: Auth0Api;
  let fakeCacheService: FakeCacheService;
  let baseUri: string;
  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;
  let audience: string;
  let scope: string;

  beforeEach(() => {
    vi.resetAllMocks();

    const domain = faker.internet.domainName();
    baseUri = `https://${domain}`;
    clientId = faker.string.uuid();
    clientSecret = faker.string.uuid();
    redirectUri = faker.internet.url();
    audience = faker.internet.url({ appendSlash: false });
    scope = 'openid';

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.domain', domain);
    fakeConfigurationService.set('auth.auth0.clientId', clientId);
    fakeConfigurationService.set('auth.auth0.clientSecret', clientSecret);
    fakeConfigurationService.set('auth.auth0.redirectUri', redirectUri);
    fakeConfigurationService.set('auth.auth0.audience', audience);
    fakeConfigurationService.set('auth.auth0.scope', scope);

    fakeCacheService = new FakeCacheService();
    target = new Auth0Api(
      networkService,
      fakeCacheService,
      fakeConfigurationService,
      new HttpErrorFactory(),
    );
  });

  describe('getAuthorizationUrl', () => {
    it('should build the Auth0 authorize URL', () => {
      const state = faker.string.alphanumeric(32);

      const url = new URL(target.getAuthorizationUrl(state));

      expect(url.origin).toBe(new URL(baseUri).origin);
      expect(url.pathname).toBe('/authorize');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe(clientId);
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(url.searchParams.get('scope')).toBe(scope);
      expect(url.searchParams.get('state')).toBe(state);
      expect(url.searchParams.get('audience')).toBe(audience);
      expect(url.searchParams.has('connection')).toBe(false);
    });

    it('should append the connection parameter when provided', () => {
      const state = faker.string.alphanumeric(32);

      const url = new URL(target.getAuthorizationUrl(state, 'google-oauth2'));
      expect(url.searchParams.get('connection')).toBe('google-oauth2');
    });
  });

  describe('exchangeAuthorizationCode', () => {
    it('should exchange an authorization code for tokens', async () => {
      const code = faker.string.alphanumeric(32);
      const tokenResponse = {
        access_token: faker.string.alphanumeric(),
        refresh_token: faker.string.alphanumeric(),
        id_token: faker.string.alphanumeric(),
        token_type: 'Bearer',
        expires_in: faker.number.int({ min: 60, max: 3_600 }),
      };
      networkService.postForm.mockResolvedValueOnce({
        status: 200,
        data: rawify(tokenResponse),
      });

      await expect(target.exchangeAuthorizationCode(code)).resolves.toBe(
        tokenResponse,
      );

      expect(networkService.postForm).toHaveBeenCalledWith({
        url: new URL('/oauth/token', baseUri).toString(),
        data: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        },
      });
    });

    it('should map network errors', async () => {
      networkService.postForm.mockRejectedValueOnce(
        new NetworkResponseError(
          new URL('/oauth/token', baseUri),
          {
            status: 401,
          } as Response,
          { message: 'Unauthorized' },
        ),
      );

      await expect(
        target.exchangeAuthorizationCode(faker.string.alphanumeric(32)),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Management API token caching', () => {
    beforeEach(() => {
      networkService.get.mockResolvedValue({
        status: 200,
        data: rawify([]),
      });
      networkService.delete.mockResolvedValue({
        status: 204,
        data: rawify(undefined),
      });
    });

    it('should use a cached token for Management API requests', async () => {
      const accessToken = faker.string.alphanumeric();
      const extUserId = faker.string.uuid();
      await fakeCacheService.hSet(
        new CacheDir('auth0_management_api_token', ''),
        accessToken,
        3_600,
      );

      await target.listUserAuthenticationMethods(extUserId);
      await target.deleteUserAuthenticationMethod(
        extUserId,
        faker.string.uuid(),
      );

      expect(networkService.postForm).not.toHaveBeenCalled();
      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          networkRequest: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        }),
      );
      expect(networkService.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          networkRequest: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        }),
      );
    });

    it('should cache a new token until one minute before expiry', async () => {
      const accessToken = faker.string.alphanumeric();
      const extUserId = faker.string.uuid();
      const cacheSetSpy = vi.spyOn(fakeCacheService, 'hSet');
      networkService.postForm.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          access_token: accessToken,
          expires_in: 3_600,
        }),
      });

      await target.listUserAuthenticationMethods(extUserId);

      expect(cacheSetSpy).toHaveBeenCalledWith(
        new CacheDir('auth0_management_api_token', ''),
        accessToken,
        3_540,
        0,
      );
      await expect(
        fakeCacheService.hGet(
          new CacheDir('auth0_management_api_token', ''),
        ),
      ).resolves.toBe(accessToken);
      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          networkRequest: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        }),
      );
    });

    it('should share a token request between concurrent callers', async () => {
      const accessToken = faker.string.alphanumeric();
      networkService.postForm.mockResolvedValueOnce({
        status: 200,
        data: rawify({
          access_token: accessToken,
          expires_in: 3_600,
        }),
      });

      await Promise.all([
        target.listUserAuthenticationMethods(faker.string.uuid()),
        target.listUserAuthenticationMethods(faker.string.uuid()),
      ]);

      expect(networkService.postForm).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          networkRequest: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        }),
      );
      expect(networkService.get).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          networkRequest: {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        }),
      );
    });
  });
});
