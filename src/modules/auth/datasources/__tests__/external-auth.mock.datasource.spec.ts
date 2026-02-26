// SPDX-License-Identifier: FSL-1.1-MIT
import { UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { MockExternalAuthDatasource } from '@/modules/auth/datasources/external-auth.mock.datasource';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('MockExternalAuthDatasource', () => {
  const mockBaseUrl = 'http://localhost:3000';
  let target: MockExternalAuthDatasource;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'externalAuth.mockBaseUrl') return mockBaseUrl;
      throw new Error(`Unexpected config key: ${key}`);
    });
    target = new MockExternalAuthDatasource(mockConfigurationService);
  });

  describe('getOAuthAuthorizationUrl', () => {
    it('should return the mock consent page URL with state and redirect_uri', async () => {
      const state = faker.string.alphanumeric(32);
      const redirectUri = faker.internet.url({ appendSlash: false });

      const url = await target.getOAuthAuthorizationUrl({
        provider: 'google',
        clientId: faker.string.alphanumeric(32),
        codeChallenge: faker.string.alphanumeric(32),
        codeChallengeMethod: 'S256',
        redirectUri,
        state,
      });

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe(
        `${mockBaseUrl}/v1/auth/mock/consent`,
      );
      expect(parsed.searchParams.get('state')).toBe(state);
      expect(parsed.searchParams.get('redirect_uri')).toBe(redirectUri);
    });

    it('should work for the microsoft provider', async () => {
      const state = faker.string.alphanumeric(32);
      const redirectUri = faker.internet.url({ appendSlash: false });

      const url = await target.getOAuthAuthorizationUrl({
        provider: 'microsoft',
        clientId: faker.string.alphanumeric(32),
        codeChallenge: faker.string.alphanumeric(32),
        codeChallengeMethod: 'S256',
        redirectUri,
        state,
      });

      expect(url).toContain('/v1/auth/mock/consent');
    });
  });

  describe('exchangeOAuthCode', () => {
    it('should decode the email from a mock_ prefixed code', async () => {
      const email = faker.internet.email();
      const code = `mock_${encodeURIComponent(email)}`;

      const user = await target.exchangeOAuthCode({
        code,
        codeVerifier: faker.string.alphanumeric(32),
        redirectUri: faker.internet.url(),
      });

      expect(user.email).toBe(email);
      expect(user.externalId).toBe(`mock_${email}`);
      expect(user.emailVerified).toBe(true);
    });

    it('should fall back to mock@example.com for codes without the mock_ prefix', async () => {
      const user = await target.exchangeOAuthCode({
        code: 'some-other-code',
        codeVerifier: faker.string.alphanumeric(32),
        redirectUri: faker.internet.url(),
      });

      expect(user.email).toBe('mock@example.com');
      expect(user.externalId).toBe('mock_mock@example.com');
      expect(user.emailVerified).toBe(true);
    });

    it('should throw UnauthorizedException for the reserved "invalid" code', async () => {
      await expect(
        target.exchangeOAuthCode({
          code: 'invalid',
          codeVerifier: faker.string.alphanumeric(32),
          redirectUri: faker.internet.url(),
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
