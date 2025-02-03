import { UsersRepository } from '@/domain/users/users.repository';
import type { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UserStatus } from '@/domain/users/entities/user.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { authPayloadDtoBuilder } from '@/domain/auth/entities/__tests__/auth-payload-dto.entity.builder';
import { mockPostgresDatabaseService } from '@/datasources/db/v2/__tests__/postgresql-database.service.mock';
import { mockRepository } from '@/datasources/db/v2/__tests__/repository.mock';
import type { EntityManager } from 'typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { Wallet } from '@/datasources/wallets/entities/wallets.entity.db';
import { userBuilder } from '@/datasources/users/entities/__tests__/users.entity.db.builder';
import { faker } from '@faker-js/faker/.';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { walletBuilder } from '@/datasources/wallets/entities/__tests__/wallets.entity.db.builder';
import { getAddress } from 'viem';
import { WalletsRepository } from '@/domain/wallets/wallets.repository';
import type { IWalletsRepository } from '@/domain/wallets/wallets.repository.interface';

let walletsRepository: IWalletsRepository;
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

    walletsRepository = new WalletsRepository(mockPostgresDatabaseService);
    usersRepository = new UsersRepository(
      mockPostgresDatabaseService,
      walletsRepository,
    );
    mockPostgresDatabaseService.getRepository.mockImplementation((entity) => {
      if (entity === User) return Promise.resolve(mockUserRepository);
      if (entity === Wallet) return Promise.resolve(mockWalletRepository);

      return Promise.reject(new Error('Invalid entity'));
    });
    mockPostgresDatabaseService.transaction.mockImplementation((fn) =>
      fn(mockEntityManager),
    );
  });

  describe('createWithWallet', () => {
    it.only('should create a user and associated wallet in a transaction', async () => {
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

      const result = await usersRepository.createWithWallet({
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

  describe('deleteWalletFromUser', () => {
    it('should remove a wallet from a user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const addressToRemove = getAddress(faker.finance.ethereumAddress());

      const mockWallets = [walletBuilder().build(), walletBuilder().build()];
      const mockUser = userBuilder().with('wallets', mockWallets).build();
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockWalletRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await usersRepository.deleteWalletFromUser({
        authPayload,
        walletAddress: addressToRemove,
      });

      expect(mockWalletRepository.delete).toHaveBeenCalledWith({
        user: { id: mockUser.id },
        address: addressToRemove,
      });
    });

    it('should throw an UnauthorizedException if the auth payload is empty', async () => {
      const authPayload = new AuthPayload();
      const addressToRemove = getAddress(faker.finance.ethereumAddress());

      await expect(
        usersRepository.deleteWalletFromUser({
          authPayload,
          walletAddress: addressToRemove,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an ConflictException if the user tries to remove the currently authenticated wallet', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', walletAddress)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      await expect(
        usersRepository.deleteWalletFromUser({
          authPayload,
          walletAddress,
        }),
      ).rejects.toThrow(
        new ConflictException('Cannot remove the current wallet'),
      );
    });

    it('should throw a BadRequestException if there is only one wallet', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);
      const addressToRemove = getAddress(faker.finance.ethereumAddress());

      const mockWallets = [walletBuilder().build()];
      const mockUser = userBuilder().with('wallets', mockWallets).build();
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);

      await expect(
        usersRepository.deleteWalletFromUser({
          authPayload,
          walletAddress: addressToRemove,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw a NotFoundException if the user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const addressToRemove = getAddress(faker.finance.ethereumAddress());

      mockWalletRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        usersRepository.deleteWalletFromUser({
          authPayload,
          walletAddress: addressToRemove,
        }),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('should throw a NotFoundException if the wallet does not exist for the user', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      const addressToRemove = getAddress(faker.finance.ethereumAddress());

      const mockWallets = [walletBuilder().build(), walletBuilder().build()];
      const mockUser = userBuilder().with('wallets', mockWallets).build();
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser);
      mockWalletRepository.delete.mockResolvedValue({ affected: 0, raw: {} });

      await expect(
        usersRepository.deleteWalletFromUser({
          authPayload,
          walletAddress: addressToRemove,
        }),
      ).rejects.toThrow(
        new ConflictException(
          `User could not be removed from wallet. Wallet=${addressToRemove}`,
        ),
      );
    });
  });

  describe('getUser', () => {
    it('should throw an UnauthorizedException if the auth payload is empty', async () => {
      const authPayload = new AuthPayload();

      await expect(usersRepository.getWithWallets(authPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user information and associated wallets', async () => {
      const signerAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', signerAddress)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      const mockUser = userBuilder().with('id', 1).build();

      const mockAuthenticatedWallet = walletBuilder()
        .with('user', mockUser)
        .with('address', signerAddress)
        .build();

      const mockAdditionalWallet = walletBuilder()
        .with('user', mockUser)
        .with('address', getAddress(faker.finance.ethereumAddress()))
        .build();

      mockWalletRepository.findOne.mockResolvedValueOnce(
        mockAuthenticatedWallet,
      );
      mockWalletRepository.find.mockResolvedValueOnce([
        {
          id: mockAuthenticatedWallet.id,
          address: mockAuthenticatedWallet.address,
        },
        {
          id: mockAdditionalWallet.id,
          address: mockAdditionalWallet.address,
        },
      ]);

      const result = await usersRepository.getWithWallets(authPayload);

      expect(mockWalletRepository.findOne).toHaveBeenCalledWith({
        where: { address: authPayload.signer_address },
        relations: { user: true },
      });
      expect(mockWalletRepository.find).toHaveBeenCalledWith({
        select: ['id', 'address'],
        where: { user: mockAuthenticatedWallet.user },
      });
      expect(result).toEqual({
        id: mockUser.id,
        status: mockUser.status,
        wallets: [
          {
            id: mockAuthenticatedWallet.id,
            address: mockAuthenticatedWallet.address,
          },
          {
            id: mockAdditionalWallet.id,
            address: mockAdditionalWallet.address,
          },
        ],
      });
    });

    it('should throw an UnauthorizedException if no authenticated wallet is defined', async () => {
      const authPayload = new AuthPayload();

      await expect(usersRepository.getWithWallets(authPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw a NotFoundException if the user is not found', async () => {
      const authPayloadDto = authPayloadDtoBuilder().build();
      const authPayload = new AuthPayload(authPayloadDto);

      mockWalletRepository.findOne.mockResolvedValueOnce(null);

      await expect(usersRepository.getWithWallets(authPayload)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });
  });

  describe('delete', () => {
    it('should throw an UnauthorizedException if the auth payload is empty', async () => {
      const authPayload = new AuthPayload();

      await expect(usersRepository.delete(authPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should successfully delete a user', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', walletAddress)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      mockUserRepository.delete.mockResolvedValueOnce({ affected: 1, raw: {} });

      await usersRepository.delete(authPayload);

      expect(mockUserRepository.delete).toHaveBeenCalledWith({
        wallets: { address: walletAddress },
      });
    });

    it('should throw a NotFoundException if the user is not found', async () => {
      const walletAddress = getAddress(faker.finance.ethereumAddress());
      const authPayloadDto = authPayloadDtoBuilder()
        .with('signer_address', walletAddress)
        .build();
      const authPayload = new AuthPayload(authPayloadDto);

      mockUserRepository.delete.mockResolvedValueOnce({ affected: 0, raw: {} });

      await expect(usersRepository.delete(authPayload)).rejects.toThrow(
        new NotFoundException(`Could not delete user. Wallet=${walletAddress}`),
      );

      expect(mockUserRepository.delete).toHaveBeenCalledWith({
        wallets: { address: walletAddress },
      });
    });

    it('should throw an UnauthorizedException if no authenticated wallet is defined', async () => {
      const authPayload = new AuthPayload();

      await expect(usersRepository.delete(authPayload)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });
  });
});
