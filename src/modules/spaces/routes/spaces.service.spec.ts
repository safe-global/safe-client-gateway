// SPDX-License-Identifier: FSL-1.1-MIT
import { SpacesService } from '@/modules/spaces/routes/spaces.service';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import type { IUsersRepository } from '@/modules/users/domain/users.repository.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { SpaceSafe } from '@/modules/spaces/datasources/entities/space-safes.entity.db';
import {
  siweAuthPayloadDtoBuilder,
  oidcAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';

const spacesRepositoryMock = {
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const membersRepositoryMock = {
  find: jest.fn(),
  findOne: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

const usersRepositoryMock = {
  activateIfPending: jest.fn(),
} as jest.MockedObjectDeep<IUsersRepository>;

describe('SpacesService', () => {
  let service: SpacesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SpacesService(
      spacesRepositoryMock,
      membersRepositoryMock,
      usersRepositoryMock,
    );
  });

  describe('getActiveOrInvitedSpaces', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return spaces for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const user = userBuilder().with('id', userId).build();
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', user)
        .with('space', space)
        .build();

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
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])(
      'should return safeCount 0 when %s space has no safes',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        const userId = Number(authPayload.sub);
        const space = spaceBuilder().build();
        const member = memberBuilder()
          .with('user', userBuilder().with('id', userId).build())
          .with('space', space)
          .build();

        membersRepositoryMock.find.mockResolvedValue([member]);
        spacesRepositoryMock.find.mockResolvedValue([
          spaceBuilder()
            .with('id', space.id)
            .with('members', [])
            .with('safes', [])
            .build(),
        ]);

        const result = await service.getActiveOrInvitedSpaces(authPayload);

        expect(result).toHaveLength(1);
        expect(result[0].safeCount).toBe(0);
      },
    );

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])(
      'should return safeCount 0 when %s space.safes is undefined',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        const userId = Number(authPayload.sub);
        const space = spaceBuilder().build();
        const member = memberBuilder()
          .with('user', userBuilder().with('id', userId).build())
          .with('space', space)
          .build();

        membersRepositoryMock.find.mockResolvedValue([member]);
        spacesRepositoryMock.find.mockResolvedValue([
          spaceBuilder().with('id', space.id).with('members', []).build(),
        ]);

        const result = await service.getActiveOrInvitedSpaces(authPayload);

        expect(result).toHaveLength(1);
        expect(result[0].safeCount).toBe(0);
      },
    );

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])(
      'should return empty array when %s user has no memberships',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());

        membersRepositoryMock.find.mockResolvedValue([]);

        const result = await service.getActiveOrInvitedSpaces(authPayload);

        expect(result).toEqual([]);
        expect(spacesRepositoryMock.find).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])(
      'should return multiple spaces with correct safeCount for %s user',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        const userId = Number(authPayload.sub);
        const user = userBuilder().with('id', userId).build();
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

        membersRepositoryMock.find.mockResolvedValue([member1, member2]);
        spacesRepositoryMock.find.mockResolvedValue([
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
        ]);

        const result = await service.getActiveOrInvitedSpaces(authPayload);

        expect(result).toHaveLength(2);
        expect(result[0].safeCount).toBe(2);
        expect(result[1].safeCount).toBe(1);
      },
    );

    it('should throw UnauthorizedException for unauthenticated payload', async () => {
      const authPayload = new AuthPayload();

      await expect(
        service.getActiveOrInvitedSpaces(authPayload),
      ).rejects.toThrow(UnauthorizedException);

      expect(membersRepositoryMock.find).not.toHaveBeenCalled();
    });
  });

  describe('getActiveOrInvitedSpace', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should return a space by ID for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const space = spaceBuilder().build();
      const member = memberBuilder()
        .with('user', userBuilder().with('id', userId).build())
        .with('space', space)
        .build();

      membersRepositoryMock.find.mockResolvedValue([member]);
      spacesRepositoryMock.find.mockResolvedValue([space]);

      const result = await service.getActiveOrInvitedSpace(
        space.id,
        authPayload,
      );

      expect(result.id).toBe(space.id);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])(
      'should throw NotFoundException when space ID not found for %s user',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        const userId = Number(authPayload.sub);
        const space = spaceBuilder().build();
        const member = memberBuilder()
          .with('user', userBuilder().with('id', userId).build())
          .with('space', space)
          .build();

        membersRepositoryMock.find.mockResolvedValue([member]);
        spacesRepositoryMock.find.mockResolvedValue([space]);

        await expect(
          service.getActiveOrInvitedSpace(999999, authPayload),
        ).rejects.toThrow(new NotFoundException('Space not found.'));
      },
    );

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])(
      'should throw NotFoundException when %s user has no spaces',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());

        membersRepositoryMock.find.mockResolvedValue([]);

        await expect(
          service.getActiveOrInvitedSpace(1, authPayload),
        ).rejects.toThrow(new NotFoundException('Space not found.'));
      },
    );
  });

  describe('create', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should create space for %s user', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      const userId = Number(authPayload.sub);
      const name = faker.word.noun();
      const expectedResponse = { id: faker.number.int(), name };

      spacesRepositoryMock.create.mockResolvedValue(expectedResponse);

      const result = await service.create({
        name,
        status: 'ACTIVE',
        authPayload,
      });

      expect(result).toEqual(expectedResponse);
      expect(usersRepositoryMock.activateIfPending).toHaveBeenCalledWith(
        userId,
      );
      expect(spacesRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId }),
      );
    });

    it('should activate a PENDING user when creating space', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const userId = Number(authPayload.sub);
      const expectedResponse = {
        id: faker.number.int(),
        name: faker.word.noun(),
      };

      spacesRepositoryMock.create.mockResolvedValue(expectedResponse);

      await service.create({
        name: expectedResponse.name,
        status: 'ACTIVE',
        authPayload,
      });

      expect(usersRepositoryMock.activateIfPending).toHaveBeenCalledWith(
        userId,
      );
    });

    it('should throw UnauthorizedException for unauthenticated payload', async () => {
      await expect(
        service.create({
          name: faker.word.noun(),
          status: 'ACTIVE',
          authPayload: new AuthPayload(),
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersRepositoryMock.activateIfPending).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should update space for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());
      const updatePayload = { name: faker.word.noun() };
      const expectedResponse = { id: spaceId, name: updatePayload.name };

      spacesRepositoryMock.findOne.mockResolvedValue(
        spaceBuilder().with('id', spaceId).build(),
      );
      spacesRepositoryMock.update.mockResolvedValue(expectedResponse);

      const result = await service.update({
        id: spaceId,
        updatePayload,
        authPayload,
      });

      expect(result).toEqual(expectedResponse);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw when %s user is not admin', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      spacesRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.update({
          id: faker.number.int(),
          updatePayload: { name: faker.word.noun() },
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('delete', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should delete space for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());

      spacesRepositoryMock.findOne.mockResolvedValue(
        spaceBuilder().with('id', spaceId).build(),
      );

      await service.delete({ id: spaceId, authPayload });

      expect(spacesRepositoryMock.delete).toHaveBeenCalledWith(spaceId);
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder] as const,
      ['OIDC', oidcAuthPayloadDtoBuilder] as const,
    ])('should throw when %s user is not admin', async (_label, builder) => {
      const authPayload = new AuthPayload(builder().build());
      spacesRepositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.delete({
          id: faker.number.int(),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
