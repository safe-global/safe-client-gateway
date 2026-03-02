import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';

const userRepositoryMock = {
  findByWalletAddressOrFail: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

const spacesRepositoryMock = {
  find: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const membersRepositoryMock = {
  find: jest.fn(),
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
    it('should return spaces with safeCount computed from safes length', async () => {
      const signerAddress = faker.finance.ethereumAddress() as Address;
      const authPayload = new AuthPayload({
        signer_address: signerAddress,
        chain_id: '1',
      });
      const user = userBuilder().build();
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', user)
        .with('space', space)
        .build();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(user);
      membersRepositoryMock.find.mockResolvedValue([member]);

      const mockSpace = spaceBuilder()
        .with('id', space.id)
        .with('name', space.name)
        .with('members', [member])
        .with('safes', [
          { id: 1 } as SpaceSafe,
          { id: 2 } as SpaceSafe,
          { id: 3 } as SpaceSafe,
        ])
        .build();

      spacesRepositoryMock.find.mockResolvedValue([mockSpace]);

      const result = await service.getActiveOrInvitedSpaces(authPayload);

      expect(result).toEqual([
        {
          id: space.id,
          name: space.name,
          members: [member],
          safeCount: 3,
        },
      ]);
      expect(userRepositoryMock.findByWalletAddressOrFail).toHaveBeenCalledWith(
        signerAddress,
      );
      expect(membersRepositoryMock.find).toHaveBeenCalledWith({
        where: {
          user: { id: user.id },
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
            name: true,
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
      const user = userBuilder().build();
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', user)
        .with('space', space)
        .build();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(user);
      membersRepositoryMock.find.mockResolvedValue([member]);

      const mockSpace = spaceBuilder()
        .with('id', space.id)
        .with('members', [])
        .with('safes', [])
        .build();

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
      const user = userBuilder().build();
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', user)
        .with('space', space)
        .build();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(user);
      membersRepositoryMock.find.mockResolvedValue([member]);

      const mockSpace = spaceBuilder()
        .with('id', space.id)
        .with('members', [])
        .build();
      // safes is undefined (not set via builder)

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
      const user = userBuilder().build();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(user);
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
      const user = userBuilder().build();
      const space1 = spaceBuilder().build();
      const space2 = spaceBuilder().build();
      const member1 = memberBuilder()
        .with('user', user)
        .with('space', space1)
        .with('status', 'ACTIVE')
        .build();
      const member2 = memberBuilder()
        .with('user', user)
        .with('space', space2)
        .with('status', 'INVITED')
        .build();

      userRepositoryMock.findByWalletAddressOrFail.mockResolvedValue(user);
      membersRepositoryMock.find.mockResolvedValue([member1, member2]);

      const mockSpaces = [
        spaceBuilder()
          .with('id', space1.id)
          .with('members', [])
          .with('safes', [{ id: 1 } as SpaceSafe, { id: 2 } as SpaceSafe])
          .build(),
        spaceBuilder()
          .with('id', space2.id)
          .with('members', [])
          .with('safes', [{ id: 3 } as SpaceSafe])
          .build(),
      ];

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
