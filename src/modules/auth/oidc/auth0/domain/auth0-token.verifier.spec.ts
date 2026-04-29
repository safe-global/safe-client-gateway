// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { toSecondsTimestamp } from '@/domain/common/utils/time';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  createAuth0JwksResponse,
  getAuth0JwksFixture,
  getFetchUrl,
  signAuth0Jwt,
} from '@/modules/auth/oidc/auth0/__tests__/auth0-jwks.helper';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { Auth0TokenSchema } from '@/modules/auth/oidc/auth0/domain/entities/auth0-token.entity';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const loggingServiceMock = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('Auth0TokenVerifier', () => {
  let target: Auth0TokenVerifier;
  let issuer: string;
  let clientId: string;
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.resetAllMocks();

    const domain = faker.internet.domainName();
    issuer = `https://${domain}/`;
    clientId = faker.string.uuid();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.domain', domain);
    fakeConfigurationService.set('auth.auth0.clientId', clientId);
    fakeConfigurationService.set('auth.auth0.jwksCacheMaxAgeMs', 60 * 60_000);
    fakeConfigurationService.set('auth.auth0.jwksCooldownMs', 30_000);
    fetchMock = jest.spyOn(global, 'fetch');

    target = new Auth0TokenVerifier(
      fakeConfigurationService,
      loggingServiceMock,
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('verifyAndDecode', () => {
    it('should decode and parse the ID token with correct options', async () => {
      const email = faker.internet.email().toLowerCase();
      const sub = faker.string.uuid();
      const issuedAt = toSecondsTimestamp(faker.date.recent());
      const notBefore = toSecondsTimestamp(faker.date.recent());
      const expiresAt = toSecondsTimestamp(faker.date.future());
      const jwtId = faker.string.uuid();
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {
          sub,
          email,
          email_verified: true,
          iat: issuedAt,
          nbf: notBefore,
          exp: expiresAt,
          jti: jwtId,
        },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      const result = await target.verifyAndDecode(token);

      expect(result).toEqual({
        aud: clientId,
        email,
        email_verified: true,
        exp: new Date(expiresAt * 1_000),
        iat: new Date(issuedAt * 1_000),
        iss: issuer,
        jti: jwtId,
        nbf: new Date(notBefore * 1_000),
        sub,
      });
      expect(getFetchUrl(fetchMock.mock.calls[0][0])).toBe(
        `${issuer}.well-known/jwks.json`,
      );
    });

    it('should cache the remote JWKS', async () => {
      const sub = faker.string.uuid();
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const sign = (): string =>
        signAuth0Jwt({
          issuer,
          audience: clientId,
          kid,
          privateKey,
          payload: { sub },
        });

      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await target.verifyAndDecode(sign());
      await target.verifyAndDecode(sign());

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should parse an ID token without optional claims', async () => {
      const sub = faker.string.uuid();
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: { sub },
        noTimestamp: true,
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      const result = await target.verifyAndDecode(token);

      expect(result.sub).toBe(sub);
      expect(result.iat).toBeUndefined();
      expect(result.nbf).toBeUndefined();
      expect(result.exp).toBeUndefined();
    });

    it('should throw when the ID token has email_verified true without an email claim', async () => {
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {
          sub: faker.string.uuid(),
          email_verified: true,
        },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: ID token verification failed:'),
      );
    });

    it('should throw when the ID token has an invalid email claim', async () => {
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {
          sub: faker.string.uuid(),
          email: faker.word.noun(),
          email_verified: true,
        },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: ID token verification failed:'),
      );
    });

    it('should throw when the signing key cannot be found in the JWKS', async () => {
      const { privateKey, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: { sub: faker.string.uuid() },
      });

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ keys: [] }), { status: 200 }),
      );

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
    });

    it('should throw when the ID token uses an unexpected algorithm', async () => {
      const token = jwt.sign({ sub: faker.string.uuid() }, 'secret', {
        algorithm: 'HS256',
        header: { kid: faker.string.alphanumeric(12), alg: 'HS256' },
        issuer,
        audience: clientId,
      });

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
    });

    it('should throw when the ID token issuer does not match Auth0 config', async () => {
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer: faker.internet.url(),
        audience: clientId,
        kid,
        privateKey,
        payload: { sub: faker.string.uuid() },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
    });

    it('should throw when the ID token audience does not match Auth0 config', async () => {
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: faker.string.uuid(),
        kid,
        privateKey,
        payload: { sub: faker.string.uuid() },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
    });

    it('should throw when the ID token is expired', async () => {
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {
          sub: faker.string.uuid(),
          exp: toSecondsTimestamp(faker.date.past()),
        },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
    });

    it('should throw when the ID token has no subject claim', async () => {
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {},
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
    });

    it('should rethrow unexpected verification errors', async () => {
      const error = new Error('unexpected parse failure');
      const { privateKey, publicJwk, kid } = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: { sub: faker.string.uuid() },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));
      const parseSpy = jest
        .spyOn(Auth0TokenSchema, 'parse')
        .mockImplementationOnce(() => {
          throw error;
        });

      try {
        await expect(target.verifyAndDecode(token)).rejects.toThrow(error);
        expect(loggingServiceMock.debug).not.toHaveBeenCalled();
      } finally {
        parseSpy.mockRestore();
      }
    });

    it('should throw when ID token verification fails', async () => {
      const trustedKeyPair = getAuth0JwksFixture();
      const untrustedKeyPair = getAuth0JwksFixture();
      const token = signAuth0Jwt({
        issuer,
        audience: clientId,
        kid: trustedKeyPair.kid,
        privateKey: untrustedKeyPair.privateKey,
        payload: { sub: faker.string.uuid() },
      });

      fetchMock.mockResolvedValueOnce(
        createAuth0JwksResponse(trustedKeyPair.publicJwk, trustedKeyPair.kid),
      );

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid ID token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: ID token verification failed:'),
      );
    });
  });
});
