// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthService } from '@/modules/auth/routes/auth.service';
import type { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import type { Hex } from 'viem';
import type { JwtPayloadWithClaims } from '@/datasources/jwt/jwt-claims.entity';
import type { AuthPayloadDto } from '@/modules/auth/domain/entities/auth-payload.entity';

const siweRepositoryMock = {
  generateNonce: jest.fn(),
  getValidatedSiweMessage: jest.fn(),
} as jest.MockedObjectDeep<ISiweRepository>;

const authRepositoryMock = {
  signToken: jest.fn(),
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
} as jest.MockedObjectDeep<IAuthRepository>;

const usersRepositoryMock = {
  findOrCreateByWalletAddress: jest.fn(),
} as unknown as jest.MockedObjectDeep<IUsersRepository>;

const loggingServiceMock = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('AuthService', () => {
  let target: AuthService;
  let maxValidityPeriodInSeconds: number;
  let postLoginRedirectUri: string;
  let auth0Domain: string;
  let auth0ClientId: string;

  function createService(
    overrides?: Partial<{
      auth0Domain: string;
      auth0ClientId: string;
      postLoginRedirectUri: string;
    }>,
  ): AuthService {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'auth.maxValidityPeriodSeconds',
      maxValidityPeriodInSeconds,
    );
    fakeConfigurationService.set(
      'auth.postLoginRedirectUri',
      overrides?.postLoginRedirectUri ?? postLoginRedirectUri,
    );
    fakeConfigurationService.set('application.isProduction', true);
    if (overrides?.auth0Domain) {
      fakeConfigurationService.set('auth.auth0.domain', overrides.auth0Domain);
    }
    if (overrides?.auth0ClientId) {
      fakeConfigurationService.set(
        'auth.auth0.clientId',
        overrides.auth0ClientId,
      );
    }
    return new AuthService(
      siweRepositoryMock,
      authRepositoryMock,
      fakeConfigurationService,
      usersRepositoryMock,
      loggingServiceMock,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    maxValidityPeriodInSeconds = faker.number.int({ min: 3600, max: 86400 });
    postLoginRedirectUri = faker.internet.url({ appendSlash: false });
    auth0Domain = faker.internet.domainName();
    auth0ClientId = faker.string.uuid();

    target = createService({
      auth0Domain,
      auth0ClientId,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getNonce', () => {
    it('should return a generated nonce', async () => {
      const nonce = { nonce: faker.string.alphanumeric(32) };
      siweRepositoryMock.generateNonce.mockResolvedValue(nonce);

      const result = await target.getNonce();

      expect(result).toEqual(nonce);
      expect(siweRepositoryMock.generateNonce).toHaveBeenCalledTimes(1);
    });
  });

  describe('authenticateWithSiwe', () => {
    let siweArgs: {
      message: string;
      signature: Hex;
    };
    let now: Date;
    let userId: number;

    beforeEach(() => {
      now = new Date();
      jest.setSystemTime(now);

      siweArgs = {
        message: faker.lorem.sentence(),
        signature: `0x${faker.string.hexadecimal({ length: 130 }).slice(2)}`,
      };
      userId = faker.number.int({ min: 1, max: 1000 });

      usersRepositoryMock.findOrCreateByWalletAddress.mockResolvedValue(userId);
    });

    it('should sign a token with validated SIWE message fields', async () => {
      const expectedToken = faker.string.alphanumeric(32);
      const siweMessage = siweMessageBuilder()
        .with(
          'expirationTime',
          new Date(now.getTime() + 30 * 60 * 1_000), // 30 min from now
        )
        .with('issuedAt', now)
        .with('notBefore', now)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      authRepositoryMock.signToken.mockReturnValue(expectedToken);

      const result = await target.authenticateWithSiwe(siweArgs);

      expect(result).toEqual({ accessToken: expectedToken });
      expect(siweRepositoryMock.getValidatedSiweMessage).toHaveBeenCalledWith(
        siweArgs,
      );
      expect(
        usersRepositoryMock.findOrCreateByWalletAddress,
      ).toHaveBeenCalledWith(siweMessage.address);
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        {
          auth_method: 'siwe',
          sub: userId.toString(),
          chain_id: siweMessage.chainId.toString(),
          signer_address: siweMessage.address,
        },
        {
          nbf: new Date(siweMessage.notBefore!),
          exp: new Date(siweMessage.expirationTime!),
          iat: new Date(siweMessage.issuedAt!),
        },
      );
    });

    it('should use max expiration time when expirationTime is not set', async () => {
      const siweMessage = siweMessageBuilder()
        .with('expirationTime', undefined)
        .with('issuedAt', now)
        .with('notBefore', undefined)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      authRepositoryMock.signToken.mockReturnValue('token');

      await target.authenticateWithSiwe(siweArgs);

      const maxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );
      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          exp: maxExpiration,
        }),
      );
    });

    it('should omit nbf when notBefore is not set', async () => {
      const siweMessage = siweMessageBuilder()
        .with('notBefore', undefined)
        .with('expirationTime', new Date(now.getTime() + 30 * 60 * 1_000))
        .with('issuedAt', now)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      authRepositoryMock.signToken.mockReturnValue('token');

      await target.authenticateWithSiwe(siweArgs);

      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ nbf: expect.anything() }),
      );
    });

    it('should use current date for iat when issuedAt is not set', async () => {
      const siweMessage = siweMessageBuilder()
        .with('issuedAt', undefined)
        .with('expirationTime', new Date(now.getTime() + 30 * 60 * 1_000))
        .with('notBefore', undefined)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      authRepositoryMock.signToken.mockReturnValue('token');

      await target.authenticateWithSiwe(siweArgs);

      expect(authRepositoryMock.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          iat: now,
        }),
      );
    });

    it('should throw ForbiddenException when expirationTime exceeds max validity', async () => {
      const tooFarExpiration = new Date(
        now.getTime() + (maxValidityPeriodInSeconds + 1) * 1_000,
      );

      const siweMessage = siweMessageBuilder()
        .with('expirationTime', tooFarExpiration)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);

      await expect(target.authenticateWithSiwe(siweArgs)).rejects.toThrow(
        new ForbiddenException(
          `Cannot issue token for longer than ${maxValidityPeriodInSeconds} seconds`,
        ),
      );

      expect(
        usersRepositoryMock.findOrCreateByWalletAddress,
      ).not.toHaveBeenCalled();
      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should propagate errors from findOrCreateByWalletAddress', async () => {
      const siweMessage = siweMessageBuilder()
        .with('expirationTime', new Date(now.getTime() + 30 * 60 * 1_000))
        .with('issuedAt', now)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      const error = new Error('Database connection failed');
      usersRepositoryMock.findOrCreateByWalletAddress.mockRejectedValue(error);

      await expect(target.authenticateWithSiwe(siweArgs)).rejects.toThrow(
        error,
      );

      expect(authRepositoryMock.signToken).not.toHaveBeenCalled();
    });

    it('should not throw when expirationTime equals max validity', async () => {
      const exactMaxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );

      const siweMessage = siweMessageBuilder()
        .with('expirationTime', exactMaxExpiration)
        .with('issuedAt', now)
        .build();

      siweRepositoryMock.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      authRepositoryMock.signToken.mockReturnValue('token');

      await expect(target.authenticateWithSiwe(siweArgs)).resolves.toEqual({
        accessToken: 'token',
      });
    });
  });

  describe('getLogoutRedirectUrl', () => {
    it('should return Auth0 logout URL for OIDC token when Auth0 is configured', () => {
      authRepositoryMock.decodeToken.mockReturnValue({
        auth_method: 'oidc',
      } as unknown as JwtPayloadWithClaims<AuthPayloadDto>);

      const result = target.getLogoutRedirectUrl('some-access-token');

      expect(result).toBe(
        `https://${auth0Domain}/v2/logout?client_id=${auth0ClientId}&returnTo=${encodeURIComponent(postLoginRedirectUri)}`,
      );
    });

    it('should include redirect_url in Auth0 returnTo for OIDC token', () => {
      authRepositoryMock.decodeToken.mockReturnValue({
        auth_method: 'oidc',
      } as unknown as JwtPayloadWithClaims<AuthPayloadDto>);

      const redirectUrl = `${postLoginRedirectUri}/settings`;
      const result = target.getLogoutRedirectUrl(
        'some-access-token',
        redirectUrl,
      );

      expect(result).toBe(
        `https://${auth0Domain}/v2/logout?client_id=${auth0ClientId}&returnTo=${encodeURIComponent(redirectUrl)}`,
      );
    });

    it('should return direct redirect URL for SiWe token', () => {
      authRepositoryMock.decodeToken.mockReturnValue({
        auth_method: 'siwe',
      } as unknown as ReturnType<typeof authRepositoryMock.decodeToken>);

      const result = target.getLogoutRedirectUrl('some-access-token');

      expect(result).toBe(postLoginRedirectUri);
    });

    it('should return direct redirect URL when no access token', () => {
      const result = target.getLogoutRedirectUrl(undefined);

      expect(result).toBe(postLoginRedirectUri);
      expect(authRepositoryMock.decodeToken).not.toHaveBeenCalled();
    });

    it('should return direct redirect URL when token is corrupt', () => {
      authRepositoryMock.decodeToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = target.getLogoutRedirectUrl('corrupt-token');

      expect(result).toBe(postLoginRedirectUri);
    });

    it('should return direct redirect URL for OIDC token when Auth0 is not configured', () => {
      const serviceWithoutAuth0 = createService();
      authRepositoryMock.decodeToken.mockReturnValue({
        auth_method: 'oidc',
      } as unknown as ReturnType<typeof authRepositoryMock.decodeToken>);

      const result =
        serviceWithoutAuth0.getLogoutRedirectUrl('some-access-token');

      expect(result).toBe(postLoginRedirectUri);
    });

    it('should throw BadRequestException for cross-origin redirect_url', () => {
      expect(() =>
        target.getLogoutRedirectUrl(undefined, 'https://evil.com'),
      ).toThrow(BadRequestException);
    });
  });
});
