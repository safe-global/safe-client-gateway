// SPDX-License-Identifier: FSL-1.1-MIT
import type { IAuth0Api } from '@/modules/auth/oidc/auth0/datasources/auth0-api.interface';
import { Auth0Repository } from '@/modules/auth/oidc/auth0/domain/auth0.repository';
import type { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';

const auth0ApiMock = {
  getAuthorizationUrl: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
} as jest.MockedObjectDeep<IAuth0Api>;

const auth0TokenVerifierMock = {
  verifyAndDecode: jest.fn(),
} as jest.MockedObjectDeep<Auth0TokenVerifier>;

describe('Auth0Repository', () => {
  let target: Auth0Repository;

  beforeEach(() => {
    jest.resetAllMocks();

    target = new Auth0Repository(auth0ApiMock, auth0TokenVerifierMock);
  });

  describe('getAuthorizationUrl', () => {
    it('should delegate to the Auth0 API', () => {
      const state = faker.string.alphanumeric(32);
      const expectedUrl = faker.internet.url();
      auth0ApiMock.getAuthorizationUrl.mockReturnValue(expectedUrl);

      const result = target.getAuthorizationUrl(state);

      expect(result).toBe(expectedUrl);
      expect(auth0ApiMock.getAuthorizationUrl).toHaveBeenCalledWith(
        state,
        undefined,
      );
    });

    it('should pass connection through to the Auth0 API', () => {
      const state = faker.string.alphanumeric(32);
      const expectedUrl = faker.internet.url();
      auth0ApiMock.getAuthorizationUrl.mockReturnValue(expectedUrl);

      const result = target.getAuthorizationUrl(state, 'google-oauth2');

      expect(result).toBe(expectedUrl);
      expect(auth0ApiMock.getAuthorizationUrl).toHaveBeenCalledWith(
        state,
        'google-oauth2',
      );
    });
  });

  describe('authenticateWithAuthorizationCode', () => {
    it('should exchange the authorization code and return verified token claims', async () => {
      const code = faker.string.alphanumeric(32);
      const token = faker.string.alphanumeric(64);
      const decodedToken = {
        sub: `auth0|${faker.string.uuid()}`,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
        email: faker.internet.email().toLowerCase(),
        email_verified: true,
      };

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: faker.string.alphanumeric(64),
          refresh_token: faker.string.alphanumeric(64),
          id_token: token,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );
      auth0TokenVerifierMock.verifyAndDecode.mockResolvedValue(decodedToken);

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual(decodedToken);
      expect(auth0ApiMock.exchangeAuthorizationCode).toHaveBeenCalledWith(code);
      expect(auth0TokenVerifierMock.verifyAndDecode).toHaveBeenCalledWith(
        token,
      );
    });

    it('should keep authentication working when the token has no email claims', async () => {
      const code = faker.string.alphanumeric(32);
      const token = faker.string.alphanumeric(64);
      const decodedToken = {
        sub: `auth0|${faker.string.uuid()}`,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
      };

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: faker.string.alphanumeric(64),
          refresh_token: faker.string.alphanumeric(64),
          id_token: token,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );
      auth0TokenVerifierMock.verifyAndDecode.mockResolvedValue(decodedToken);

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual(decodedToken);
      expect(auth0TokenVerifierMock.verifyAndDecode).toHaveBeenCalledWith(
        token,
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
      const error = new Error('invalid token');

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: faker.string.alphanumeric(64),
          refresh_token: faker.string.alphanumeric(64),
          id_token: faker.string.alphanumeric(64),
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );
      auth0TokenVerifierMock.verifyAndDecode.mockRejectedValue(error);

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow(error);
    });

    it('should throw when Auth0 returns an invalid token response', async () => {
      const code = faker.string.alphanumeric(32);

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: faker.string.alphanumeric(64),
          refresh_token: faker.string.alphanumeric(64),
          id_token: '',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow();
      expect(auth0TokenVerifierMock.verifyAndDecode).not.toHaveBeenCalled();
    });

    it('should throw when Auth0 returns an unexpected token_type', async () => {
      const code = faker.string.alphanumeric(32);

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: faker.string.alphanumeric(64),
          id_token: faker.string.alphanumeric(64),
          token_type: 'MAC',
        }),
      );

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow();
      expect(auth0TokenVerifierMock.verifyAndDecode).not.toHaveBeenCalled();
    });
  });
});
