// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { Auth0Service } from '@/datasources/auth0/auth0.service';
import type { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import { faker } from '@faker-js/faker';
import { UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

const jwtServiceMock = {
  decode: jest.fn(),
} as jest.MockedObjectDeep<IJwtService>;

describe('Auth0Service', () => {
  let service: Auth0Service;
  let domain: string;
  let apiIdentifier: string;
  let signingSecret: string;

  beforeEach(() => {
    jest.resetAllMocks();

    domain = faker.internet.domainName();
    apiIdentifier = faker.string.alphanumeric();
    signingSecret = faker.string.alphanumeric();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.auth0.domain', domain);
    fakeConfigurationService.set('auth.auth0.apiIdentifier', apiIdentifier);
    fakeConfigurationService.set('auth.auth0.signingSecret', signingSecret);

    service = new Auth0Service(jwtServiceMock, fakeConfigurationService);
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

      const result = service.verifyAndDecode(accessToken);

      expect(result.sub).toBe(decoded.sub);
      expect(result.iat).toEqual(new Date(now * 1_000));
      expect(result.nbf).toEqual(new Date(now * 1_000));
      expect(result.exp).toEqual(new Date((now + 3600) * 1_000));
      expect(jwtServiceMock.decode).toHaveBeenCalledTimes(1);
      expect(jwtServiceMock.decode).toHaveBeenCalledWith(accessToken, {
        issuer: `https://${domain}/`,
        audience: apiIdentifier,
        secretOrPrivateKey: signingSecret,
      });
    });

    it('should parse a token without optional claims', () => {
      const accessToken = faker.string.alphanumeric();
      const decoded = { sub: faker.string.numeric() };
      jwtServiceMock.decode.mockReturnValue(decoded);

      const result = service.verifyAndDecode(accessToken);

      expect(result.sub).toBe(decoded.sub);
      expect(result.iat).toBeUndefined();
      expect(result.nbf).toBeUndefined();
      expect(result.exp).toBeUndefined();
    });

    it('should throw if sub is missing', () => {
      const accessToken = faker.string.alphanumeric();
      jwtServiceMock.decode.mockReturnValue({});

      expect(() => service.verifyAndDecode(accessToken)).toThrow();
    });

    it('should throw UnauthorizedException for JsonWebTokenError', () => {
      const accessToken = faker.string.alphanumeric();
      jwtServiceMock.decode.mockImplementation(() => {
        throw new JsonWebTokenError(
          'jwt audience invalid. expected: https://secret.example.com/',
        );
      });

      expect(() => service.verifyAndDecode(accessToken)).toThrow(
        new UnauthorizedException('Invalid access token'),
      );
    });

    it('should throw UnauthorizedException for TokenExpiredError', () => {
      const accessToken = faker.string.alphanumeric();
      jwtServiceMock.decode.mockImplementation(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });

      expect(() => service.verifyAndDecode(accessToken)).toThrow(
        new UnauthorizedException('Invalid access token'),
      );
    });

    it('should propagate non-JWT errors from jwtService.decode', () => {
      const accessToken = faker.string.alphanumeric();
      const error = new Error('unexpected error');
      jwtServiceMock.decode.mockImplementation(() => {
        throw error;
      });

      expect(() => service.verifyAndDecode(accessToken)).toThrow(error);
    });
  });
});
