// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IAuth0Api } from '@/modules/auth/auth0/datasources/auth0-api.interface';
import { Auth0Repository } from '@/modules/auth/auth0/domain/auth0.repository';
import type { Auth0TokenVerifier } from '@/modules/auth/auth0/domain/auth0-token.verifier';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';

const auth0ApiMock = {
  exchangeAuthorizationCode: jest.fn(),
} as jest.MockedObjectDeep<IAuth0Api>;

const auth0TokenVerifierMock = {
  verifyAndDecode: jest.fn(),
} as jest.MockedObjectDeep<Auth0TokenVerifier>;

describe('Auth0Repository', () => {
  let target: Auth0Repository;
  let baseUri: string;
  let clientId: string;
  let clientSecret: string;
  let redirectUri: string;
  let audience: string;
  let scope: string;

  beforeEach(() => {
    jest.resetAllMocks();

    baseUri = faker.internet.url({ appendSlash: false });
    clientId = faker.string.uuid();
    clientSecret = faker.string.uuid();
    redirectUri = faker.internet.url();
    audience = faker.internet.url({ appendSlash: false });
    scope = 'openid';

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.baseUri', baseUri);
    fakeConfigurationService.set('auth.auth0.clientId', clientId);
    fakeConfigurationService.set('auth.auth0.clientSecret', clientSecret);
    fakeConfigurationService.set('auth.auth0.redirectUri', redirectUri);
    fakeConfigurationService.set('auth.auth0.audience', audience);
    fakeConfigurationService.set('auth.auth0.scope', scope);

    target = new Auth0Repository(
      fakeConfigurationService,
      auth0ApiMock,
      auth0TokenVerifierMock,
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
    });
  });

  describe('authenticateWithAuthorizationCode', () => {
    it('should exchange the code and verify the returned access token', async () => {
      const code = faker.string.alphanumeric(32);
      const accessToken = faker.string.alphanumeric(64);
      const decodedToken = {
        sub: `auth0|${faker.string.uuid()}`,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
      };

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: accessToken,
          refresh_token: faker.string.alphanumeric(64),
          id_token: faker.string.alphanumeric(64),
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );
      auth0TokenVerifierMock.verifyAndDecode.mockReturnValue(decodedToken);

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual(decodedToken);
      expect(auth0ApiMock.exchangeAuthorizationCode).toHaveBeenCalledWith({
        baseUri,
        clientId,
        clientSecret,
        code,
        redirectUri,
      });
      expect(auth0TokenVerifierMock.verifyAndDecode).toHaveBeenCalledWith(
        accessToken,
      );
    });

    it('should propagate code exchange errors', async () => {
      const code = faker.string.alphanumeric(32);
      const error = new Error('exchange failed');

      auth0ApiMock.exchangeAuthorizationCode.mockRejectedValue(error);

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow(error);
      expect(auth0TokenVerifierMock.verifyAndDecode).not.toHaveBeenCalled();
    });

    it('should propagate token verifier errors', async () => {
      const code = faker.string.alphanumeric(32);
      const error = new Error('invalid access token');

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: faker.string.alphanumeric(64),
          refresh_token: faker.string.alphanumeric(64),
          id_token: faker.string.alphanumeric(64),
          token_type: 'Bearer',
        }),
      );
      auth0TokenVerifierMock.verifyAndDecode.mockImplementation(() => {
        throw error;
      });

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow(error);
    });
  });
});
