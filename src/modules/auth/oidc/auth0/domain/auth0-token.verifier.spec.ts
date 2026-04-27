// SPDX-License-Identifier: FSL-1.1-MIT
import { generateKeyPairSync } from 'node:crypto';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { JWT_RS_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import type { ILoggingService } from '@/logging/logging.interface';
import { auth0IdTokenJwksFactory } from '@/modules/auth/oidc/auth0/domain/auth0-id-token-jwks.factory';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

const loggingServiceMock = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

function getFetchUrl(input: Parameters<typeof fetch>[0]): string {
  return input instanceof Request ? input.url : input.toString();
}

function getRsaKeyPair(): {
  privateKey: string;
  publicJwk: JsonWebKey;
} {
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });

  return {
    privateKey: keyPair.privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString(),
    publicJwk: keyPair.publicKey.export({ format: 'jwk' }),
  };
}

function signRs256IdToken(args: {
  issuer: string;
  audience: string;
  kid: string;
  privateKey: string;
  payload: object;
}): string {
  return jwt.sign(args.payload, args.privateKey, {
    algorithm: JWT_RS_ALGORITHM,
    issuer: args.issuer,
    audience: args.audience,
    header: { kid: args.kid, alg: JWT_RS_ALGORITHM },
  });
}

function jwksResponse(publicJwk: JsonWebKey, kid: string): Response {
  return new Response(
    JSON.stringify({
      keys: [
        {
          ...publicJwk,
          kid,
          alg: JWT_RS_ALGORITHM,
          use: 'sig',
        },
      ],
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    },
  );
}

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
      auth0IdTokenJwksFactory(fakeConfigurationService),
      loggingServiceMock,
    );
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('verifyAndDecode', () => {
    it('should verify the id token with the Auth0 JWKS public key', async () => {
      const kid = faker.string.alphanumeric(12);
      const email = faker.internet.email().toLowerCase();
      const { privateKey, publicJwk } = getRsaKeyPair();
      const idToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {
          sub: faker.string.uuid(),
          email,
          email_verified: true,
        },
      });
      fetchMock.mockResolvedValueOnce(jwksResponse(publicJwk, kid));

      const result = await target.verifyAndDecode(idToken);

      expect(result).toEqual(
        expect.objectContaining({
          email,
          email_verified: true,
        }),
      );
      expect(getFetchUrl(fetchMock.mock.calls[0][0])).toBe(
        `${issuer}.well-known/jwks.json`,
      );
    });

    it('should cache the remote JWKS', async () => {
      const kid = faker.string.alphanumeric(12);
      const sub = faker.string.uuid();
      const { privateKey, publicJwk } = getRsaKeyPair();
      const sign = (): string =>
        signRs256IdToken({
          issuer,
          audience: clientId,
          kid,
          privateKey,
          payload: { sub },
        });

      fetchMock.mockResolvedValueOnce(jwksResponse(publicJwk, kid));

      await target.verifyAndDecode(sign());
      await target.verifyAndDecode(sign());

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('should allow email_verified without an email claim', async () => {
      const kid = faker.string.alphanumeric(12);
      const { privateKey, publicJwk } = getRsaKeyPair();
      const idToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: {
          sub: faker.string.uuid(),
          email_verified: true,
        },
      });
      fetchMock.mockResolvedValueOnce(jwksResponse(publicJwk, kid));

      const result = await target.verifyAndDecode(idToken);

      expect(result.email).toBeUndefined();
      expect(result.email_verified).toBe(true);
    });

    it('should throw when the id token has an invalid email claim', async () => {
      const kid = faker.string.alphanumeric(12);
      const { privateKey, publicJwk } = getRsaKeyPair();
      const idToken = signRs256IdToken({
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
      fetchMock.mockResolvedValueOnce(jwksResponse(publicJwk, kid));

      await expect(target.verifyAndDecode(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: id token verification failed:'),
      );
    });

    it('should throw when the signing key cannot be found in the JWKS', async () => {
      const kid = faker.string.alphanumeric(12);
      const { privateKey } = getRsaKeyPair();
      const idToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        privateKey,
        payload: { sub: faker.string.uuid() },
      });

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ keys: [] }), { status: 200 }),
      );

      await expect(target.verifyAndDecode(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
    });

    it('should throw when the id token uses an unexpected algorithm', async () => {
      const idToken = jwt.sign({ sub: faker.string.uuid() }, 'secret', {
        algorithm: 'HS256',
        header: { kid: faker.string.alphanumeric(12), alg: 'HS256' },
        issuer,
        audience: clientId,
      });

      await expect(target.verifyAndDecode(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
    });

    it('should throw when JWT verification fails', async () => {
      const kid = faker.string.alphanumeric(12);
      const trustedKeyPair = getRsaKeyPair();
      const untrustedKeyPair = getRsaKeyPair();
      const idToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        privateKey: untrustedKeyPair.privateKey,
        payload: { sub: faker.string.uuid() },
      });

      fetchMock.mockResolvedValueOnce(
        jwksResponse(trustedKeyPair.publicJwk, kid),
      );

      await expect(target.verifyAndDecode(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: id token verification failed:'),
      );
    });
  });
});
