import { UsersRepository } from '@/domain/users/users.repository';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { mockRepository } from '@/datasources/db/v2/__tests__/repository.mock';
import type { EntityManager } from 'typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/users/entities/wallets.entity.db';
import { userBuilder } from '@/datasources/users/entities/__tests__/users.entity.db.builder';
import { faker } from '@faker-js/faker/.';
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { walletBuilder } from '@/datasources/users/entities/__tests__/wallets.entity.db.builder';

let usersRepository: IUsersRepository;
const mockUserRepository = { ...mockRepository };
const mockWalletRepository = { ...mockRepository };
const mockEntityManager: EntityManager = {
  getRepository: jest.fn((entity) => {
    if (entity === User) return mockUserRepository;
    if (entity === Wallet) return mockWalletRepository;
    return null;
  }),
} as unknown as EntityManager;

describe('UsersRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    usersRepository = new UsersRepository(mockPostgresDatabaseService);
    mockPostgresDatabaseService.transaction.mockImplementation((fn) =>
      fn(mockEntityManager),
    );
  });

  describe('createUserWithWallet', () => {
    it('should create a user and associated wallet in a transaction', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const status = UserStatus.ACTIVE;

      const mockUser = userBuilder().build();
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.insert.mockResolvedValue({
        identifiers: [{ id: mockUser.id }],
        generatedMaps: [{ id: 1 }],
        raw: jest.fn(),
      });

      const result = await usersRepository.createUserWithWallet({
        status,
        authPayload,
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        status,
      });
      expect(mockUserRepository.insert).toHaveBeenCalledWith(mockUser);

      expect(mockWalletRepository.insert).toHaveBeenCalledWith({
        user: mockUser,
        address: authPayload.signer_address,
      });

      expect(result).toEqual({ id: mockUser.id });
    });
  });

  describe('removeWalletFromUser', () => {
    it('should remove a wallet from a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const addressToRemove = faker.finance.ethereumAddress();
      const mockAuthenticatedWallet = walletBuilder().build();
      mockWalletRepository.findOne.mockResolvedValueOnce(
        mockAuthenticatedWallet,
      );
      mockWalletRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await usersRepository.removeWalletFromUser({
        authPayload,
        addressToRemove: addressToRemove as `0x${string}`,
      });

      expect(mockWalletRepository.delete).toHaveBeenCalledWith({
        user: mockAuthenticatedWallet.user,
        address: addressToRemove,
      });
    });

    it('should throw an UnauthorizedException if the auth payload is empty', async () => {
      const authPayload = new AuthPayload();
      const addressToRemove = faker.finance.ethereumAddress();

      await expect(
        usersRepository.removeWalletFromUser({
          authPayload,
          addressToRemove: addressToRemove as `0x${string}`,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an ConflictException if the user tries to remove the currently authenticated wallet', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();

      const authPayload = new AuthPayload(authPayloadDto);

      await expect(
        usersRepository.removeWalletFromUser({
          authPayload,
          addressToRemove: authPayload.signer_address as `0x${string}`,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw a NotFoundException if the user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const addressToRemove = faker.finance.ethereumAddress();
      mockWalletRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        usersRepository.removeWalletFromUser({
          authPayload,
          addressToRemove: addressToRemove as `0x${string}`,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw a NotFoundException if the wallet does not exist for the user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const addressToRemove = faker.finance.ethereumAddress();
      const mockAuthenticatedWallet = walletBuilder().build();
      mockWalletRepository.findOne.mockResolvedValueOnce(
        mockAuthenticatedWallet,
      );
      mockWalletRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(
        usersRepository.removeWalletFromUser({
          authPayload,
          addressToRemove: addressToRemove as `0x${string}`,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
