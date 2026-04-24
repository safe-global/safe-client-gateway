// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { MembersRepository } from '@/modules/users/domain/members.repository';
import type { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import type { IWalletsRepository } from '@/modules/wallets/domain/wallets.repository.interface';
import { getAddress } from 'viem';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

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

  let membersOrmRepository: { findOne: jest.Mock };
  let entityManager: { insert: jest.Mock };
  let postgresDatabaseService: jest.MockedObjectDeep<PostgresDatabaseService>;
  let target: MembersRepository;

  beforeEach(() => {
    jest.resetAllMocks();

    membersOrmRepository = {
      findOne: jest.fn(),
    };
    entityManager = {
      insert: jest.fn(),
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
    });
    expect(result).toEqual([
      {
        userId: inviteeUserId,
        spaceId,
        name,
        role: 'MEMBER',
        status: 'INVITED',
        invitedBy: authPayloadDto.signer_address,
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
});
