// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import { AuthService } from '@/modules/auth/routes/auth.service';
import type { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import type { Hex } from 'viem';

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

describe('AuthService', () => {
  let target: AuthService;
  let maxValidityPeriodInSeconds: number;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    maxValidityPeriodInSeconds = faker.number.int({ min: 3600, max: 86400 });

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'auth.maxValidityPeriodSeconds',
      maxValidityPeriodInSeconds,
    );

    target = new AuthService(
      siweRepositoryMock,
      authRepositoryMock,
      fakeConfigurationService,
      usersRepositoryMock,
    );
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
});
