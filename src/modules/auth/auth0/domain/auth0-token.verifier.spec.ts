// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { Auth0TokenVerifier } from '@/modules/auth/auth0/domain/auth0-token.verifier';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

const jwtServiceMock = {
  decode: jest.fn(),
} as jest.MockedObjectDeep<IJwtService>;

const loggingServiceMock = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('Auth0TokenVerifier', () => {
  let target: Auth0TokenVerifier;
  let issuer: string;
  let audience: string;
  let signingSecret: string;

  beforeEach(() => {
    jest.resetAllMocks();

    issuer = faker.internet.url({ appendSlash: false });
    audience = faker.string.alphanumeric();
    signingSecret = faker.string.alphanumeric(32);

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.baseUri', issuer);
    fakeConfigurationService.set('auth.auth0.audience', audience);
    fakeConfigurationService.set('auth.auth0.signingSecret', signingSecret);

    target = new Auth0TokenVerifier(
      jwtServiceMock,
      fakeConfigurationService,
      loggingServiceMock,
    );
  });

  describe('verifyAndDecode', () => {
    it('should decode and parse the token with correct options', () => {
      const accessToken = faker.string.alphanumeric();
      const now = Math.floor(Date.now() / 1_000);
      const decoded = {
        sub: faker.string.uuid(),
        iat: now,
        nbf: now,
        exp: now + 3600,
      };
      jwtServiceMock.decode.mockReturnValue(decoded);

      const result = target.verifyAndDecode(accessToken);

      expect(result.sub).toBe(decoded.sub);
      expect(result.iat).toEqual(new Date(now * 1_000));
      expect(result.nbf).toEqual(new Date(now * 1_000));
      expect(result.exp).toEqual(new Date((now + 3600) * 1_000));
      expect(jwtServiceMock.decode).toHaveBeenCalledTimes(1);
      expect(jwtServiceMock.decode).toHaveBeenCalledWith(accessToken, {
        issuer,
        audience,
        secretOrPrivateKey: signingSecret,
      });
    });

    it('should parse a token without optional claims', () => {
      const accessToken = faker.string.alphanumeric();
      const decoded = { sub: faker.string.numeric() };
      jwtServiceMock.decode.mockReturnValue(decoded);

      const result = target.verifyAndDecode(accessToken);

      expect(result.sub).toBe(decoded.sub);
      expect(result.iat).toBeUndefined();
      expect(result.nbf).toBeUndefined();
      expect(result.exp).toBeUndefined();
    });

    it('should throw if sub is missing', () => {
      const accessToken = faker.string.alphanumeric();
      jwtServiceMock.decode.mockReturnValue({});

      expect(() => target.verifyAndDecode(accessToken)).toThrow();
    });

    it('should throw UnauthorizedException for JsonWebTokenError', () => {
      const accessToken = faker.string.alphanumeric();
      const message =
        'jwt audience invalid. expected: https://secret.example.com/';
      jwtServiceMock.decode.mockImplementation(() => {
        throw new JsonWebTokenError(message);
      });

      expect(() => target.verifyAndDecode(accessToken)).toThrow(
        new UnauthorizedException('Invalid access token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledTimes(1);
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        `Auth0: JWT verification failed: ${message}`,
      );
    });

    it('should throw UnauthorizedException for TokenExpiredError', () => {
      const accessToken = faker.string.alphanumeric();
      const message = 'jwt expired';
      jwtServiceMock.decode.mockImplementation(() => {
        throw new TokenExpiredError(message, new Date());
      });

      expect(() => target.verifyAndDecode(accessToken)).toThrow(
        new UnauthorizedException('Invalid access token'),
      );
      expect(loggingServiceMock.debug).toHaveBeenCalledTimes(1);
      expect(loggingServiceMock.debug).toHaveBeenCalledWith(
        `Auth0: JWT verification failed: ${message}`,
      );
    });

    it('should propagate non-JWT errors from jwtService.decode', () => {
      const accessToken = faker.string.alphanumeric();
      const error = new Error('unexpected error');
      jwtServiceMock.decode.mockImplementation(() => {
        throw error;
      });

      expect(() => target.verifyAndDecode(accessToken)).toThrow(error);
    });
  });
});
