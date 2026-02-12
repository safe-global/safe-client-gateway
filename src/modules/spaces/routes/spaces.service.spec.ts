import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import type { Space } from '@/modules/spaces/datasources/entities/space.entity.db';
import type { Member } from '@/modules/users/datasources/entities/member.entity.db';
import type { User } from '@/modules/users/domain/entities/user.entity';

const userRepositoryMock: jest.MockedObjectDeep<IUsersRepository> = {
  createWithWallet: jest.fn(),
  create: jest.fn(),
  getWithWallets: jest.fn(),
  addWalletToUser: jest.fn(),
  delete: jest.fn(),
  deleteWalletFromUser: jest.fn(),
  findByWalletAddressOrFail: jest.fn(),
  findByWalletAddress: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

const spacesRepositoryMock: jest.MockedObjectDeep<ISpacesRepository> = {
  create: jest.fn(),
  findOneOrFail: jest.fn(),
  findOne: jest.fn(),
  findOrFail: jest.fn(),
  find: jest.fn(),
  findByUserIdOrFail: jest.fn(),
  findByUserId: jest.fn(),
  findOneByUserIdOrFail: jest.fn(),
  findOneByUserId: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const membersRepositoryMock: jest.MockedObjectDeep<IMembersRepository> = {
  findOneOrFail: jest.fn(),
  findOne: jest.fn(),
  findOrFail: jest.fn(),
  find: jest.fn(),
  inviteUsers: jest.fn(),
  acceptInvite: jest.fn(),
  declineInvite: jest.fn(),
  findAuthorizedMembersOrFail: jest.fn(),
  updateRole: jest.fn(),
  updateAlias: jest.fn(),
  removeUser: jest.fn(),
  removeSelf: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

describe('SpacesService', () => {
  let service: SpacesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SpacesService(
      userRepositoryMock,
      spacesRepositoryMock,
      membersRepositoryMock,
    );
  });

  describe('getActiveOrInvitedSpaces', () => {
    const buildMockUser = (id: number): User => ({
      id,
      status: 'ACTIVE',
      wallets: [],
      members: [],
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent(),
    });

    it('should return spaces with safeCount computed from safes length', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const userId = faker.number.int();
      const spaceId = faker.number.int();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(
        buildMockUser(userId),
      );

      membersRepositoryMock.find.mockResolvedValue([
        {
          id: faker.number.int(),
          space: { id: spaceId } as Space,
          status: 'ACTIVE',
        } as Member,
      ]);

      const mockSpace = {
        id: spaceId,
        name: 'Test Space',
        members: [
          {
            id: 1,
            role: 'ADMIN',
            name: 'Alice',
            alias: null,
            invitedBy: null,
            status: 'ACTIVE',
            user: { id: userId, status: 'ACTIVE' },
          },
        ],
        safes: [{ id: 1 }, { id: 2 }, { id: 3 }],
      } as unknown as Space;

      spacesRepositoryMock.find.mockResolvedValue([mockSpace]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toEqual([
        {
          id: spaceId,
          name: 'Test Space',
          members: mockSpace.members,
          safeCount: 3,
        },
      ]);
      expect(userRepositoryMock.findByWalletAddressOrFail).toHaveBeenCalledWith(
        signerAddress,
      );
      expect(membersRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          user: { id: userId },
          status: expect.anything(),
        },
        relations: ['space'],
      });
      expect(spacesRepositoryMock.find).toHaveBeenCalledWith({
        where: { id: expect.anything() },
        select: {
          id: true,
          name: true,
          members: {
            role: true,
            invitedBy: true,
            status: true,
            user: { id: true },
          },
          safes: { id: true },
        },
        relations: { members: { user: true }, safes: true },
      });
    });

    it('should return safeCount 0 when space has no safes', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const userId = faker.number.int();
      const spaceId = faker.number.int();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(
        buildMockUser(userId),
      );

      membersRepositoryMock.find.mockResolvedValue([
        {
          id: faker.number.int(),
          space: { id: spaceId } as Space,
        } as Member,
      ]);

      const mockSpace = {
        id: spaceId,
        name: 'Empty Space',
        members: [],
        safes: [],
      } as unknown as Space;

      spacesRepositoryMock.find.mockResolvedValue([mockSpace]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toHaveLength(1);
      expect(result[0].safeCount).toBe(0);
    });

    it('should return safeCount 0 when space.safes is undefined', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const userId = faker.number.int();
      const spaceId = faker.number.int();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(
        buildMockUser(userId),
      );

      membersRepositoryMock.find.mockResolvedValue([
        {
          id: faker.number.int(),
          space: { id: spaceId } as Space,
          status: 'ACTIVE',
        } as Member,
      ]);

      const mockSpace = {
        id: spaceId,
        name: 'No Safes Space',
        status: 'ACTIVE' as const,
        members: [],
        // safes is undefined (not loaded)
      } as unknown as Space;

      spacesRepositoryMock.find.mockResolvedValue([mockSpace]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toHaveLength(1);
      expect(result[0].safeCount).toBe(0);
    });

    it('should return empty array when user has no memberships', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const userId = faker.number.int();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(
        buildMockUser(userId),
      );

      membersRepositoryMock.find.mockResolvedValue([]);
      spacesRepositoryMock.find.mockResolvedValue([]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toEqual([]);
    });

    it('should return multiple spaces with correct safeCount each', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const userId = faker.number.int();
      const spaceId1 = faker.number.int();
      const spaceId2 = faker.number.int();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(
        buildMockUser(userId),
      );

      membersRepositoryMock.find.mockResolvedValue([
        {
          id: faker.number.int(),
          space: { id: spaceId1 } as Space,
          status: 'ACTIVE',
        } as Member,
        {
          id: faker.number.int(),
          space: { id: spaceId2 } as Space,
          status: 'INVITED',
        } as Member,
      ]);

      const mockSpaces = [
        {
          id: spaceId1,
          name: 'Space One',
          status: 'ACTIVE' as const,
          members: [],
          safes: [{ id: 1 }, { id: 2 }],
        },
        {
          id: spaceId2,
          name: 'Space Two',
          status: 'ACTIVE' as const,
          members: [],
          safes: [{ id: 3 }],
        },
      ] as unknown as Array<Space>;

      spacesRepositoryMock.find.mockResolvedValue(mockSpaces);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toHaveLength(2);
      expect(result[0].safeCount).toBe(2);
      expect(result[1].safeCount).toBe(1);
    });

    it('should throw UnauthorizedException when signer_address is not provided', async () => {
      const authPayload = new AuthPayload();

      await expect(
        service.getActiveOrInvitedSpaces(authPayload),
      ).rejects.toThrow(UnauthorizedException);

      expect(
        userRepositoryMock.findByWalletAddressOrFail,
      ).not.toHaveBeenCalled();
    });

    it('should propagate error when user is not found', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const error = new Error('User not found');

      userRepositoryMock.findByWalletAddressOrFail.mockRejectedValue(error);

      await expect(
        service.getActiveOrInvitedSpaces(authPayload),
      ).rejects.toThrow('User not found');

      expect(membersRepositoryMock.find).not.toHaveBeenCalled();
    });
  });
});
