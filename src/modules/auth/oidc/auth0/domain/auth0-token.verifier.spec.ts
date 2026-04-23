// SPDX-License-Identifier: FSL-1.1-MIT
import { generateKeyPairSync } from 'node:crypto';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

const jwtServiceMock = {
  decode: jest.fn(),
} as jest.MockedObjectDeep<IJwtService>;

const networkServiceMock = {
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

const loggingServiceMock = {
  debug: jest.fn(),
  info: jest.fn(),
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
      algorithm: 'RS256',
      issuer: args.issuer,
      audience: args.audience,
      header: { kid: args.kid, alg: 'RS256' },
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
  let audience: string;
  let clientId: string;
  let signingSecret: string;

  beforeEach(() => {
    jest.resetAllMocks();

    const domain = faker.internet.domainName();
    issuer = `https://${domain}/`;
    audience = faker.string.alphanumeric();
    clientId = faker.string.uuid();
    signingSecret = faker.string.alphanumeric(32);

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.domain', domain);
    fakeConfigurationService.set('auth.auth0.audience', audience);
    fakeConfigurationService.set('auth.auth0.clientId', clientId);
    fakeConfigurationService.set('auth.auth0.signingSecret', signingSecret);

    target = new Auth0TokenVerifier(
      jwtServiceMock,
      networkServiceMock,
      fakeConfigurationService,
      loggingServiceMock,
    );
  });

  describe('verifyAndDecodeAccessToken', () => {
    it('should decode and parse the access token with correct options', () => {
      const accessToken = faker.string.alphanumeric();
      const now = Math.floor(Date.now() / 1_000);
      const decoded = {
        sub: faker.string.uuid(),
        iat: now,
        nbf: now,
        exp: now + 3600,
      };
      jwtServiceMock.decode.mockReturnValue(decoded);

      const result = target.verifyAndDecodeAccessToken(accessToken);

      expect(result.sub).toBe(decoded.sub);
      expect(result.iat).toEqual(new Date(now * 1_000));
      expect(result.nbf).toEqual(new Date(now * 1_000));
      expect(result.exp).toEqual(new Date((now + 3600) * 1_000));
      expect(jwtServiceMock.decode).toHaveBeenCalledTimes(1);
      expect(jwtServiceMock.decode).toHaveBeenCalledWith(accessToken, {
        issuer,
        audience,
        secretOrPrivateKey: signingSecret,
        algorithms: ['HS256'],
      });
    });

    it('should parse an access token without optional claims', () => {
      const accessToken = faker.string.alphanumeric();
      const decoded = { sub: faker.string.numeric() };
      jwtServiceMock.decode.mockReturnValue(decoded);

      const result = target.verifyAndDecodeAccessToken(accessToken);

      expect(result.sub).toBe(decoded.sub);
      expect(result.iat).toBeUndefined();
      expect(result.nbf).toBeUndefined();
      expect(result.exp).toBeUndefined();
    });

    it('should preserve verified email claims when present in the verified token payload', () => {
      const accessToken = faker.string.alphanumeric();
      const email = faker.internet.email().toLowerCase();
      const decoded = {
        sub: faker.string.numeric(),
        email,
        email_verified: true,
      };
      jwtServiceMock.decode.mockReturnValue(decoded);

      const result = target.verifyAndDecodeAccessToken(accessToken);

      expect(result).toEqual(
        expect.objectContaining({
          sub: decoded.sub,
          email,
          email_verified: true,
        }),
      );
    });

    it('should throw if sub is missing', () => {
      const accessToken = faker.string.alphanumeric();
      jwtServiceMock.decode.mockReturnValue({});

      expect(() => target.verifyAndDecodeAccessToken(accessToken)).toThrow();
    });

    it('should throw UnauthorizedException for JsonWebTokenError', () => {
      const accessToken = faker.string.alphanumeric();
      const message =
        'jwt audience invalid. expected: https://secret.example.com/';
      jwtServiceMock.decode.mockImplementation(() => {
        throw new JsonWebTokenError(message);
      });

      expect(() => target.verifyAndDecodeAccessToken(accessToken)).toThrow(
        new UnauthorizedException('Invalid access token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledTimes(1);
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        `Auth0: access token JWT verification failed: ${message}`,
      );
    });

    it('should throw UnauthorizedException for TokenExpiredError', () => {
      const accessToken = faker.string.alphanumeric();
      const message = 'jwt expired';
      jwtServiceMock.decode.mockImplementation(() => {
        throw new TokenExpiredError(message, new Date());
      });

      expect(() => target.verifyAndDecodeAccessToken(accessToken)).toThrow(
        new UnauthorizedException('Invalid access token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledTimes(1);
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        `Auth0: access token JWT verification failed: ${message}`,
      );
    });

    it('should propagate non-JWT errors from jwtService.decode', () => {
      const accessToken = faker.string.alphanumeric();
      const error = new Error('unexpected error');
      jwtServiceMock.decode.mockImplementation(() => {
        throw error;
      });

      expect(() => target.verifyAndDecodeAccessToken(accessToken)).toThrow(
        error,
      );
    });
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
              alg: 'RS256',
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
          algorithms: ['RS256'],
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
          algorithm: 'RS256',
          issuer,
          audience: clientId,
          header: { kid, alg: 'RS256' },
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
              alg: 'RS256',
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
              alg: 'RS256',
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
