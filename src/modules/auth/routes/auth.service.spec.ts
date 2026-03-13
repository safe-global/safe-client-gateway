import { ForbiddenException } from '@nestjs/common';
import { AuthService } from '@/modules/auth/routes/auth.service';
import type { ISiweRepository } from '@/modules/siwe/domain/siwe.repository.interface';
import type { IAuthRepository } from '@/modules/auth/domain/auth.repository.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { IAuth0Service } from '@/datasources/auth0/auth0.service.interface';
import { siweMessageBuilder } from '@/modules/siwe/domain/entities/__tests__/siwe-message.builder';
import { faker } from '@faker-js/faker';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { Hex } from 'viem';

const maxValidityPeriodInSeconds = 60 * 60; // 1 hour

const mockSiweRepository = {
  generateNonce: jest.fn(),
  getValidatedSiweMessage: jest.fn(),
} as jest.MockedObjectDeep<ISiweRepository>;

const mockAuthRepository = {
  signToken: jest.fn(),
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
} as jest.MockedObjectDeep<IAuthRepository>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockUsersRepository = {
  findOrCreateByWalletAddress: jest.fn(),
  findOrCreateByExtUserId: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

const mockAuth0Service = {
  verifyAndDecode: jest.fn(),
} as jest.MockedObjectDeep<IAuth0Service>;

describe('AuthService', () => {
  let service: AuthService;
  const now = new Date('2024-01-01T00:00:00Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockReturnValue(
      maxValidityPeriodInSeconds,
    );

    service = new AuthService(
      mockSiweRepository,
      mockAuthRepository,
      mockConfigurationService,
      mockUsersRepository,
      mockAuth0Service,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('verifySiwe', () => {
    let siweArgs: {
      message: string;
      signature: Hex;
    };
    let userId: number;

    beforeEach(() => {
      siweArgs = {
        message: faker.lorem.sentence(),
        signature: `0x${faker.string.hexadecimal({ length: 130, prefix: '' })}`,
      };
      userId = faker.number.int({ min: 1, max: 1000 });

      mockUsersRepository.findOrCreateByWalletAddress.mockResolvedValue(userId);
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

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      mockAuthRepository.signToken.mockReturnValue(expectedToken);

      const result = await service.verifySiwe(siweArgs);

      expect(result).toEqual({ accessToken: expectedToken });
      expect(mockSiweRepository.getValidatedSiweMessage).toHaveBeenCalledWith(
        siweArgs,
      );
      expect(
        mockUsersRepository.findOrCreateByWalletAddress,
      ).toHaveBeenCalledWith(siweMessage.address);
      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
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

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      mockAuthRepository.signToken.mockReturnValue('token');

      await service.verifySiwe(siweArgs);

      const maxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );
      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
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

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      mockAuthRepository.signToken.mockReturnValue('token');

      await service.verifySiwe(siweArgs);

      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
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

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      mockAuthRepository.signToken.mockReturnValue('token');

      await service.verifySiwe(siweArgs);

      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
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

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);

      await expect(service.verifySiwe(siweArgs)).rejects.toThrow(
        new ForbiddenException(
          `Cannot issue token for longer than ${maxValidityPeriodInSeconds} seconds`,
        ),
      );

      expect(mockAuthRepository.signToken).not.toHaveBeenCalled();
    });

    it('should propagate errors from findOrCreateByWalletAddress', async () => {
      const siweMessage = siweMessageBuilder()
        .with('expirationTime', new Date(now.getTime() + 30 * 60 * 1_000))
        .with('issuedAt', now)
        .build();

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      const error = new Error('Database connection failed');
      mockUsersRepository.findOrCreateByWalletAddress.mockRejectedValue(error);

      await expect(service.verifySiwe(siweArgs)).rejects.toThrow(error);

      expect(mockAuthRepository.signToken).not.toHaveBeenCalled();
    });

    it('should not throw when expirationTime equals max validity', async () => {
      const exactMaxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );

      const siweMessage = siweMessageBuilder()
        .with('expirationTime', exactMaxExpiration)
        .with('issuedAt', now)
        .build();

      mockSiweRepository.getValidatedSiweMessage.mockResolvedValue(siweMessage);
      mockAuthRepository.signToken.mockReturnValue('token');

      await expect(service.verifySiwe(siweArgs)).resolves.toEqual({
        accessToken: 'token',
      });
    });
  });

  describe('verifyOidc', () => {
    let extUserId: string;
    let userId: number;

    beforeEach(() => {
      extUserId = faker.string.uuid();
      userId = faker.number.int({ min: 1, max: 1000 });

      mockAuth0Service.verifyAndDecode.mockReturnValue({ sub: extUserId });
      mockUsersRepository.findOrCreateByExtUserId.mockResolvedValue(userId);
      mockAuthRepository.signToken.mockReturnValue('token');
    });

    it('should sign a token with OIDC claims (no chain_id or signer_address)', async () => {
      const expectedToken = faker.string.alphanumeric(32);
      const exp = new Date(now.getTime() + 30 * 60 * 1_000);
      const iat = now;
      mockAuth0Service.verifyAndDecode.mockReturnValue({
        sub: extUserId,
        exp,
        iat,
      });
      mockAuthRepository.signToken.mockReturnValue(expectedToken);

      const accessToken = faker.string.alphanumeric(64);
      const result = await service.verifyOidc(accessToken);

      expect(result).toEqual({ accessToken: expectedToken });
      expect(mockAuth0Service.verifyAndDecode).toHaveBeenCalledWith(
        accessToken,
      );
      expect(mockUsersRepository.findOrCreateByExtUserId).toHaveBeenCalledWith(
        extUserId,
      );
      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
        {
          auth_method: 'oidc',
          sub: userId.toString(),
        },
        {
          exp,
          iat,
        },
      );
    });

    it('should use max expiration time when exp is not set', async () => {
      await service.verifyOidc(faker.string.alphanumeric(64));

      const maxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );
      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          exp: maxExpiration,
        }),
      );
    });

    it('should throw ForbiddenException when exp exceeds max validity', async () => {
      const tooFarExpiration = new Date(
        now.getTime() + (maxValidityPeriodInSeconds + 1) * 1_000,
      );
      mockAuth0Service.verifyAndDecode.mockReturnValue({
        sub: extUserId,
        exp: tooFarExpiration,
      });

      await expect(
        service.verifyOidc(faker.string.alphanumeric(64)),
      ).rejects.toThrow(
        new ForbiddenException(
          `Cannot issue token for longer than ${maxValidityPeriodInSeconds} seconds`,
        ),
      );

      expect(mockAuthRepository.signToken).not.toHaveBeenCalled();
    });

    it('should not throw when exp equals max validity', async () => {
      const exactMaxExpiration = new Date(
        now.getTime() + maxValidityPeriodInSeconds * 1_000,
      );
      mockAuth0Service.verifyAndDecode.mockReturnValue({
        sub: extUserId,
        exp: exactMaxExpiration,
      });

      await expect(
        service.verifyOidc(faker.string.alphanumeric(64)),
      ).resolves.toEqual({ accessToken: 'token' });
    });

    it('should forward nbf from Auth0 token when present', async () => {
      const nbf = new Date(now.getTime() + 60 * 1_000);
      const iat = now;
      mockAuth0Service.verifyAndDecode.mockReturnValue({
        sub: extUserId,
        nbf,
        iat,
      });

      await service.verifyOidc(faker.string.alphanumeric(64));

      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          nbf,
        }),
      );
    });

    it('should pass undefined nbf when not present in Auth0 token', async () => {
      await service.verifyOidc(faker.string.alphanumeric(64));

      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ nbf: undefined }),
      );
    });

    it('should use current date for iat when not present in Auth0 token', async () => {
      await service.verifyOidc(faker.string.alphanumeric(64));

      expect(mockAuthRepository.signToken).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          iat: now,
        }),
      );
    });

    it('should propagate errors from auth0Service.verifyAndDecode', async () => {
      const error = new Error('Invalid token');
      mockAuth0Service.verifyAndDecode.mockImplementation(() => {
        throw error;
      });

      await expect(
        service.verifyOidc(faker.string.alphanumeric(64)),
      ).rejects.toThrow(error);

      expect(mockAuthRepository.signToken).not.toHaveBeenCalled();
    });

    it('should propagate errors from findOrCreateByExtUserId', async () => {
      const error = new Error('Database connection failed');
      mockUsersRepository.findOrCreateByExtUserId.mockRejectedValue(error);

      await expect(
        service.verifyOidc(faker.string.alphanumeric(64)),
      ).rejects.toThrow(error);

      expect(mockAuthRepository.signToken).not.toHaveBeenCalled();
    });
  });
});
