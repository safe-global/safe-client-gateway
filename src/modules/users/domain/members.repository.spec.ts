// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { MemberStatus } from '@/modules/users/domain/entities/member.entity';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';

const INVITE_EXPIRES_AT = faker.date.future();

describe('MembersRepository', () => {
  const usersRepositoryMock = {
    findOrCreateInviteeByEmail: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.MockedObjectDeep<IUsersRepository>;

  const spacesRepositoryMock = {
    findOneOrFail: jest.fn(),
  } as unknown as jest.MockedObjectDeep<ISpacesRepository>;

  const walletsRepositoryMock = {
    find: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.MockedObjectDeep<IWalletsRepository>;

  let membersOrmRepository: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let entityManager: { insert: jest.Mock; update: jest.Mock };
  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let target: MembersRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
    membersOrmRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    entityManager = {
      insert: jest.fn(),
      update: jest.fn(),
    };
    postgresDatabaseService = {
      getRepository: jest.fn().mockResolvedValue(membersOrmRepository),
      transaction: jest
        .fn()
        .mockImplementation(
          async (
            callback: (manager: typeof entityManager) => Promise<unknown>,
          ) => {
            return await callback(entityManager);
          },
        ),
    } as unknown as jest.MockedObjectDeep<PostgresDatabaseService>;

    target = new MembersRepository(
      postgresDatabaseService,
      usersRepositoryMock,
      spacesRepositoryMock,
      walletsRepositoryMock,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should invite email users via stub-user lookup and skip wallet lookup', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const spaceId = faker.number.int({ min: 1 });
    const email = faker.internet.email().toLowerCase();
    const name = faker.person.firstName();
    const inviteeUserId = faker.number.int({ min: 1 });
    const space = { id: spaceId } as unknown as Space;

    spacesRepositoryMock.findOneOrFail.mockResolvedValue(space);
    membersOrmRepository.findOne.mockResolvedValue({
      id: faker.number.int({ min: 1 }),
    });
    usersRepositoryMock.findOrCreateInviteeByEmail.mockResolvedValue(
      inviteeUserId,
    );

    const result = await target.inviteUsers({
      authPayload,
      spaceId,
      inviteExpiresAt: INVITE_EXPIRES_AT,
      users: [{ email, name, role: 'MEMBER' }],
    });

    expect(walletsRepositoryMock.find).not.toHaveBeenCalled();
    expect(usersRepositoryMock.findOrCreateInviteeByEmail).toHaveBeenCalledWith(
      email,
      entityManager,
    );
    expect(entityManager.insert).toHaveBeenCalledWith(expect.any(Function), {
      user: { id: inviteeUserId },
      space,
      name,
      role: 'MEMBER',
      status: 'INVITED',
      invitedBy: authPayloadDto.signer_address,
      inviteExpiresAt: INVITE_EXPIRES_AT,
    });
    expect(result).toEqual([
      {
        spaceId,
        name,
        role: 'MEMBER',
        status: 'INVITED',
        invitedBy: authPayloadDto.signer_address,
        inviteExpiresAt: INVITE_EXPIRES_AT,
      },
    ]);
  });

  it('should reuse wallet lookup for address invites', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const spaceId = faker.number.int({ min: 1 });
    const address = getAddress(faker.finance.ethereumAddress());
    const inviteeUserId = faker.number.int({ min: 1 });
    const space = { id: spaceId } as unknown as Space;

    spacesRepositoryMock.findOneOrFail.mockResolvedValue(space);
    membersOrmRepository.findOne.mockResolvedValue({
      id: faker.number.int({ min: 1 }),
    });
    walletsRepositoryMock.find.mockResolvedValue([
      { address, user: { id: inviteeUserId } },
    ] as Array<Wallet>);

    await target.inviteUsers({
      authPayload,
      spaceId,
      inviteExpiresAt: INVITE_EXPIRES_AT,
      users: [{ address, name: faker.person.firstName(), role: 'ADMIN' }],
    });

    expect(
      usersRepositoryMock.findOrCreateInviteeByEmail,
    ).not.toHaveBeenCalled();
    expect(walletsRepositoryMock.find).toHaveBeenCalledWith(
      expect.objectContaining({
        relations: { user: true },
      }),
    );
  });

  it('should clear invite expiration when declining an invite', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const spaceId = faker.number.int({ min: 1 });
    const memberId = faker.number.int({ min: 1 });

    spacesRepositoryMock.findOneOrFail.mockResolvedValue({
      members: [{ id: memberId }],
    } as unknown as Space);

    await target.declineInvite({
      authPayload,
      spaceId,
    });

    expect(spacesRepositoryMock.findOneOrFail).toHaveBeenCalledWith({
      where: {
        id: spaceId,
        members: {
          user: { id: Number(authPayloadDto.sub) },
          status: 'INVITED',
        },
      },
      relations: { members: { user: true } },
    });
    expect(entityManager.update).toHaveBeenCalledWith(
      expect.any(Function),
      memberId,
      {
        status: 'DECLINED',
        inviteExpiresAt: null,
      },
    );
  });

  it('should resend email invitations by resetting status and expiration', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const spaceId = faker.number.int({ min: 1 });
    const email = faker.internet.email().toLowerCase();

    membersOrmRepository.find.mockResolvedValue([
      {
        user: { id: Number(authPayloadDto.sub) },
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    ]);
    queryBuilder.execute.mockResolvedValue({ affected: 1 });

    await target.resendInvite({
      authPayload,
      spaceId,
      email,
      inviteExpiresAt: INVITE_EXPIRES_AT,
    });

    expect(queryBuilder.set).toHaveBeenCalledWith({
      status: 'INVITED',
      inviteExpiresAt: INVITE_EXPIRES_AT,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('space_id = :spaceId', {
      spaceId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'status IN (:...statuses)',
      { statuses: [MemberStatus.INVITED, MemberStatus.DECLINED] },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'user_id IN (SELECT id FROM users WHERE email = :email)',
      { email },
    );
  });

  it('should resend address invitations by resetting status and expiration', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const spaceId = faker.number.int({ min: 1 });
    const address = getAddress(faker.finance.ethereumAddress());

    membersOrmRepository.find.mockResolvedValue([
      {
        user: { id: Number(authPayloadDto.sub) },
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    ]);
    queryBuilder.execute.mockResolvedValue({ affected: 1 });

    await target.resendInvite({
      authPayload,
      spaceId,
      address,
      inviteExpiresAt: INVITE_EXPIRES_AT,
    });

    expect(queryBuilder.set).toHaveBeenCalledWith({
      status: 'INVITED',
      inviteExpiresAt: INVITE_EXPIRES_AT,
    });
    expect(queryBuilder.where).toHaveBeenCalledWith('space_id = :spaceId', {
      spaceId,
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'status IN (:...statuses)',
      { statuses: [MemberStatus.INVITED, MemberStatus.DECLINED] },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'user_id IN (SELECT user_id FROM wallets WHERE address = :address)',
      { address },
    );
  });

  it('should reject resend when caller is not an active admin', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const otherAdminUserId = Number(authPayloadDto.sub) + 1;

    membersOrmRepository.find.mockResolvedValue([
      {
        user: { id: otherAdminUserId },
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    ]);

    await expect(
      target.resendInvite({
        authPayload,
        spaceId: faker.number.int({ min: 1 }),
        address: getAddress(faker.finance.ethereumAddress()),
        inviteExpiresAt: INVITE_EXPIRES_AT,
      }),
    ).rejects.toThrow('User is not an active admin.');

    expect(queryBuilder.execute).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when no invitation row matches the resend target', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);

    membersOrmRepository.find.mockResolvedValue([
      {
        user: { id: Number(authPayloadDto.sub) },
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    ]);
    queryBuilder.execute.mockResolvedValue({ affected: 0 });

    await expect(
      target.resendInvite({
        authPayload,
        spaceId: faker.number.int({ min: 1 }),
        address: getAddress(faker.finance.ethereumAddress()),
        inviteExpiresAt: INVITE_EXPIRES_AT,
      }),
    ).rejects.toThrow('Invitation not found.');
  });

  it('should reject expired invites', async () => {
    const authPayloadDto = siweAuthPayloadDtoBuilder().build();
    const authPayload = new AuthPayload(authPayloadDto);
    const inviteExpiresAt = new Date('2026-04-30T00:00:00.000Z');

    jest.useFakeTimers().setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
    spacesRepositoryMock.findOneOrFail.mockResolvedValue(
      spaceBuilder()
        .with('members', [
          memberBuilder().with('inviteExpiresAt', inviteExpiresAt).build(),
        ])
        .build(),
    );

    await expect(
      target.acceptInvite({
        authPayload,
        spaceId: faker.number.int({ min: 1 }),
        payload: { name: faker.person.firstName() },
      }),
    ).rejects.toThrow('Invite has expired.');

    expect(postgresDatabaseService.transaction).not.toHaveBeenCalled();
  });
});
