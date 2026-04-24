// SPDX-License-Identifier: FSL-1.1-MIT
import { generateKeyPairSync } from 'node:crypto';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { AUTH0_ID_TOKEN_ALGORITHM } from '@/datasources/jwt/jwt.constants';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import jwt, { JsonWebTokenError } from 'jsonwebtoken';

const jwtServiceMock = {
  decode: jest.fn(),
} as jest.MockedObjectDeep<IJwtService>;

const networkServiceMock = {
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

const loggingServiceMock = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

function verifyJwtWithJsonWebToken(
  token: string,
  options: NonNullable<Parameters<IJwtService['decode']>[1]>,
): object {
  const verified = jwt.verify(token, options.secretOrPrivateKey!, {
    algorithms: options.algorithms,
    issuer: options.issuer,
    audience: options.audience,
    complete: true,
  });

  if (typeof verified === 'string') {
    throw new Error('Expected JWT payload object');
  }

  return verified.payload as object;
}

function signRs256IdToken(args: {
  issuer: string;
  audience: string;
  kid: string;
  payload: object;
}): { idToken: string; publicJwk: JsonWebKey } {
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privateKey = keyPair.privateKey
    .export({ format: 'pem', type: 'pkcs8' })
    .toString();
  const publicJwk = keyPair.publicKey.export({ format: 'jwk' });

  return {
    idToken: jwt.sign(args.payload, privateKey, {
      algorithm: AUTH0_ID_TOKEN_ALGORITHM,
      issuer: args.issuer,
      audience: args.audience,
      header: { kid: args.kid, alg: AUTH0_ID_TOKEN_ALGORITHM },
    }),
    publicJwk,
  };
}

function replaceJwtHeader(
  token: string,
  header: Record<string, unknown>,
): string {
  const [, payload, signature] = token.split('.');

  return [
    Buffer.from(JSON.stringify(header)).toString('base64url'),
    payload,
    signature,
  ].join('.');
}

describe('Auth0TokenVerifier', () => {
  let target: Auth0TokenVerifier;
  let issuer: string;
  let clientId: string;

  beforeEach(() => {
    jest.resetAllMocks();

    const domain = faker.internet.domainName();
    issuer = `https://${domain}/`;
    clientId = faker.string.uuid();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.domain', domain);
    fakeConfigurationService.set('auth.auth0.clientId', clientId);

    target = new Auth0TokenVerifier(
      jwtServiceMock,
      networkServiceMock,
      fakeConfigurationService,
      loggingServiceMock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('verifyAndDecodeIdToken', () => {
    it('should verify the id token with the Auth0 JWKS public key', async () => {
      const kid = faker.string.alphanumeric(12);
      const email = faker.internet.email().toLowerCase();
      const { idToken, publicJwk } = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: {
          sub: faker.string.uuid(),
          email,
          email_verified: true,
        },
      });

      networkServiceMock.get.mockResolvedValue({
        status: 200,
        data: {
          keys: [
            {
              kid,
              kty: 'RSA',
              alg: AUTH0_ID_TOKEN_ALGORITHM,
              use: 'sig',
              n: publicJwk.n,
              e: publicJwk.e,
            },
          ],
        },
      } as never);
      jwtServiceMock.decode.mockImplementation((token, options) =>
        verifyJwtWithJsonWebToken(token, options!),
      );

      const result = await target.verifyAndDecodeIdToken(idToken);

      expect(result).toEqual(
        expect.objectContaining({
          email,
          email_verified: true,
        }),
      );
      expect(networkServiceMock.get).toHaveBeenCalledWith({
        url: `${issuer}.well-known/jwks.json`,
      });
      expect(jwtServiceMock.decode).toHaveBeenCalledWith(
        idToken,
        expect.objectContaining({
          issuer,
          audience: clientId,
          algorithms: [AUTH0_ID_TOKEN_ALGORITHM],
        }),
      );
    });

    it('should cache the signing key by kid', async () => {
      const keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
      const privateKey = keyPair.privateKey
        .export({ format: 'pem', type: 'pkcs8' })
        .toString();
      const publicJwk = keyPair.publicKey.export({ format: 'jwk' });
      const kid = faker.string.alphanumeric(12);
      const sub = faker.string.uuid();
      const sign = (): string =>
        jwt.sign({ sub }, privateKey, {
          algorithm: AUTH0_ID_TOKEN_ALGORITHM,
          issuer,
          audience: clientId,
          header: { kid, alg: AUTH0_ID_TOKEN_ALGORITHM },
        });
      const firstToken = sign();
      const secondToken = sign();

      networkServiceMock.get.mockResolvedValue({
        status: 200,
        data: {
          keys: [
            {
              kid,
              kty: 'RSA',
              alg: AUTH0_ID_TOKEN_ALGORITHM,
              use: 'sig',
              n: publicJwk.n,
              e: publicJwk.e,
            },
          ],
        },
      } as never);
      jwtServiceMock.decode.mockImplementation((token, options) =>
        verifyJwtWithJsonWebToken(token, options!),
      );

      await target.verifyAndDecodeIdToken(firstToken);
      await target.verifyAndDecodeIdToken(secondToken);

      expect(networkServiceMock.get).toHaveBeenCalledTimes(1);
    });

    it('should refresh the cached signing key after the cache ttl expires', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const kid = faker.string.alphanumeric(12);
      const firstToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: { sub: faker.string.uuid() },
      });
      const secondToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: { sub: faker.string.uuid() },
      });

      networkServiceMock.get
        .mockResolvedValueOnce({
          status: 200,
          data: {
            keys: [
              {
                kid,
                kty: 'RSA',
                alg: AUTH0_ID_TOKEN_ALGORITHM,
                use: 'sig',
                n: firstToken.publicJwk.n,
                e: firstToken.publicJwk.e,
              },
            ],
          },
        } as never)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            keys: [
              {
                kid,
                kty: 'RSA',
                alg: AUTH0_ID_TOKEN_ALGORITHM,
                use: 'sig',
                n: secondToken.publicJwk.n,
                e: secondToken.publicJwk.e,
              },
            ],
          },
        } as never);
      jwtServiceMock.decode.mockImplementation((token, options) =>
        verifyJwtWithJsonWebToken(token, options!),
      );

      await target.verifyAndDecodeIdToken(firstToken.idToken);

      jest.setSystemTime(new Date(Date.now() + 60 * 60 * 1_000 + 1));

      await target.verifyAndDecodeIdToken(secondToken.idToken);

      expect(networkServiceMock.get).toHaveBeenCalledTimes(2);
    });

    it('should refresh the JWKS and retry when cached key verification fails', async () => {
      const kid = faker.string.alphanumeric(12);
      const firstToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: { sub: faker.string.uuid() },
      });
      const secondToken = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: { sub: faker.string.uuid() },
      });

      networkServiceMock.get
        .mockResolvedValueOnce({
          status: 200,
          data: {
            keys: [
              {
                kid,
                kty: 'RSA',
                alg: AUTH0_ID_TOKEN_ALGORITHM,
                use: 'sig',
                n: firstToken.publicJwk.n,
                e: firstToken.publicJwk.e,
              },
            ],
          },
        } as never)
        .mockResolvedValueOnce({
          status: 200,
          data: {
            keys: [
              {
                kid,
                kty: 'RSA',
                alg: AUTH0_ID_TOKEN_ALGORITHM,
                use: 'sig',
                n: secondToken.publicJwk.n,
                e: secondToken.publicJwk.e,
              },
            ],
          },
        } as never);
      jwtServiceMock.decode.mockImplementation((token, options) =>
        verifyJwtWithJsonWebToken(token, options!),
      );

      await target.verifyAndDecodeIdToken(firstToken.idToken);
      await expect(
        target.verifyAndDecodeIdToken(secondToken.idToken),
      ).resolves.toEqual(expect.objectContaining({ sub: expect.any(String) }));

      expect(networkServiceMock.get).toHaveBeenCalledTimes(2);
      expect(jwtServiceMock.decode).toHaveBeenCalledTimes(3);
    });

    it('should throw when the id token header has no kid', async () => {
      const idToken = jwt.sign({ sub: faker.string.uuid() }, 'secret', {
        algorithm: 'HS256',
      });

      await expect(target.verifyAndDecodeIdToken(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
    });

    it('should throw when the id token uses an unexpected algorithm', async () => {
      const kid = faker.string.alphanumeric(12);
      const { idToken: validIdToken } = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: { sub: faker.string.uuid() },
      });
      const idToken = replaceJwtHeader(validIdToken, {
        kid,
        alg: 'HS256',
      });

      await expect(target.verifyAndDecodeIdToken(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
    });

    it('should throw when the signing key cannot be found in the JWKS', async () => {
      const { idToken } = signRs256IdToken({
        issuer,
        audience: clientId,
        kid: faker.string.alphanumeric(12),
        payload: { sub: faker.string.uuid() },
      });

      networkServiceMock.get.mockResolvedValue({
        status: 200,
        data: { keys: [] },
      } as never);

      await expect(target.verifyAndDecodeIdToken(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
    });

    it('should throw UnauthorizedException when JWT verification fails', async () => {
      const kid = faker.string.alphanumeric(12);
      const { idToken, publicJwk } = signRs256IdToken({
        issuer,
        audience: clientId,
        kid,
        payload: { sub: faker.string.uuid() },
      });
      const message = 'jwt audience invalid. expected: client';

      networkServiceMock.get.mockResolvedValue({
        status: 200,
        data: {
          keys: [
            {
              kid,
              kty: 'RSA',
              alg: AUTH0_ID_TOKEN_ALGORITHM,
              use: 'sig',
              n: publicJwk.n,
              e: publicJwk.e,
            },
          ],
        },
      } as never);
      jwtServiceMock.decode.mockImplementation(() => {
        throw new JsonWebTokenError(message);
      });

      await expect(target.verifyAndDecodeIdToken(idToken)).rejects.toThrow(
        new UnauthorizedException('Invalid id token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        `Auth0: id token JWT verification failed: ${message}`,
      );
    });
  });
});
