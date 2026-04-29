// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  createAuth0JwksResponse,
  getAuth0JwksFixture,
  getFetchUrl,
  signAuth0Jwt,
} from '@/modules/auth/oidc/auth0/__tests__/auth0-jwks.helper';
import { Auth0TokenVerifier } from '@/modules/auth/oidc/auth0/domain/auth0-token.verifier';
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
    it('should verify the JWT with the Auth0 JWKS public key', async () => {
      const email = faker.internet.email().toLowerCase();
      const sub = faker.string.uuid();
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
        },
      });
      fetchMock.mockResolvedValueOnce(createAuth0JwksResponse(publicJwk, kid));

      const result = await target.verifyAndDecode(token);

      expect(result).toEqual(
        expect.objectContaining({
          aud: clientId,
          email,
          email_verified: true,
          iss: issuer,
          sub,
        }),
      );
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

    it('should allow email_verified without an email claim', async () => {
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

      const result = await target.verifyAndDecode(token);

      expect(result.email).toBeUndefined();
      expect(result.email_verified).toBe(true);
    });

    it('should throw when the JWT has an invalid email claim', async () => {
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
        new UnauthorizedException('Invalid JWT'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: JWT verification failed:'),
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
        new UnauthorizedException('Invalid JWT'),
      );
    });

    it('should throw when the JWT uses an unexpected algorithm', async () => {
      const token = jwt.sign({ sub: faker.string.uuid() }, 'secret', {
        algorithm: 'HS256',
        header: { kid: faker.string.alphanumeric(12), alg: 'HS256' },
        issuer,
        audience: clientId,
      });

      await expect(target.verifyAndDecode(token)).rejects.toThrow(
        new UnauthorizedException('Invalid JWT'),
      );
    });

    it('should throw when JWT verification fails', async () => {
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
        new UnauthorizedException('Invalid JWT'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        expect.stringContaining('Auth0: JWT verification failed:'),
      );
    });
  });
});
