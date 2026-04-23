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
  verifyAndDecodeAccessToken: jest.fn(),
  verifyAndDecodeIdToken: jest.fn(),
} as jest.MockedObjectDeep<Auth0TokenVerifier>;

describe('Auth0Repository', () => {
  let target: Auth0Repository;

  beforeEach(() => {
    jest.resetAllMocks();

    target = new Auth0Repository(auth0ApiMock, auth0TokenVerifierMock, {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    });
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
    it('should exchange the code and use email claims from the decoded id token', async () => {
      const code = faker.string.alphanumeric(32);
      const accessToken = faker.string.alphanumeric(64);
      const decodedAccessToken = {
        sub: `auth0|${faker.string.uuid()}`,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
      };
      const decodedIdToken = {
        sub: decodedAccessToken.sub,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
        email: faker.internet.email().toLowerCase(),
        email_verified: true,
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
      auth0TokenVerifierMock.verifyAndDecodeAccessToken.mockReturnValue(
        decodedAccessToken,
      );
      auth0TokenVerifierMock.verifyAndDecodeIdToken.mockResolvedValue(
        decodedIdToken,
      );

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual({
        ...decodedAccessToken,
        email: decodedIdToken.email,
        email_verified: decodedIdToken.email_verified,
      });
      expect(auth0ApiMock.exchangeAuthorizationCode).toHaveBeenCalledWith(code);
      expect(
        auth0TokenVerifierMock.verifyAndDecodeAccessToken,
      ).toHaveBeenCalledWith(accessToken);
      expect(auth0TokenVerifierMock.verifyAndDecodeIdToken).toHaveBeenCalled();
    });

    it('should keep authentication working when the id token does not provide email claims', async () => {
      const code = faker.string.alphanumeric(32);
      const accessToken = faker.string.alphanumeric(64);
      const decodedAccessToken = {
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
      auth0TokenVerifierMock.verifyAndDecodeAccessToken.mockReturnValue(
        decodedAccessToken,
      );
      auth0TokenVerifierMock.verifyAndDecodeIdToken.mockResolvedValue({
        sub: decodedAccessToken.sub,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
      });

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual(decodedAccessToken);
    });

    it('should keep authentication working when id token decoding fails', async () => {
      const code = faker.string.alphanumeric(32);
      const accessToken = faker.string.alphanumeric(64);
      const decodedAccessToken = {
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
      auth0TokenVerifierMock.verifyAndDecodeAccessToken.mockReturnValue(
        decodedAccessToken,
      );
      auth0TokenVerifierMock.verifyAndDecodeIdToken.mockRejectedValue(
        new Error('id token failed'),
      );

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual(decodedAccessToken);
    });

    it('should omit email when decoded id token sub does not match the access token sub', async () => {
      const code = faker.string.alphanumeric(32);
      const accessToken = faker.string.alphanumeric(64);
      const decodedAccessToken = {
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
      auth0TokenVerifierMock.verifyAndDecodeAccessToken.mockReturnValue(
        decodedAccessToken,
      );
      auth0TokenVerifierMock.verifyAndDecodeIdToken.mockResolvedValue({
        sub: `auth0|${faker.string.uuid()}`,
        iat: faker.date.past(),
        nbf: faker.date.recent(),
        exp: faker.date.future(),
        email: faker.internet.email().toLowerCase(),
        email_verified: true,
      });

      const result = await target.authenticateWithAuthorizationCode(code);

      expect(result).toEqual(decodedAccessToken);
    });

    it('should propagate code exchange errors', async () => {
      const code = faker.string.alphanumeric(32);
      const error = new Error('exchange failed');

      auth0ApiMock.exchangeAuthorizationCode.mockRejectedValue(error);

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow(error);
      expect(
        auth0TokenVerifierMock.verifyAndDecodeAccessToken,
      ).not.toHaveBeenCalled();
    });

    it('should propagate access token verifier errors', async () => {
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
      auth0TokenVerifierMock.verifyAndDecodeAccessToken.mockImplementation(
        () => {
          throw error;
        },
      );

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow(error);
    });

    it('should throw when Auth0 returns an invalid token response', async () => {
      const code = faker.string.alphanumeric(32);

      auth0ApiMock.exchangeAuthorizationCode.mockResolvedValue(
        rawify({
          access_token: '',
          id_token: faker.string.alphanumeric(64),
          token_type: 'Bearer',
        }),
      );

      await expect(
        target.authenticateWithAuthorizationCode(code),
      ).rejects.toThrow();
      expect(
        auth0TokenVerifierMock.verifyAndDecodeAccessToken,
      ).not.toHaveBeenCalled();
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
      expect(
        auth0TokenVerifierMock.verifyAndDecodeAccessToken,
      ).not.toHaveBeenCalled();
    });
  });
});
