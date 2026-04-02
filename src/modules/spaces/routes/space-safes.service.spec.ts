// SPDX-License-Identifier: FSL-1.1-MIT
import { SpaceSafesService } from '@/modules/spaces/routes/space-safes.service';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  siweAuthPayloadDtoBuilder,
  oidcAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { getAddress } from 'viem';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';

const addr = (): `0x${string}` => getAddress(faker.finance.ethereumAddress());

const spaceSafesRepositoryMock = {
  create: jest.fn(),
  findBySpaceId: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<ISpaceSafesRepository>;

const spacesRepositoryMock = {
  findOne: jest.fn(),
} as jest.MockedObjectDeep<ISpacesRepository>;

const membersRepositoryMock = {
  findOne: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

describe('SpaceSafesService', () => {
  let service: SpaceSafesService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new SpaceSafesService(
      spaceSafesRepositoryMock,
      spacesRepositoryMock,
      membersRepositoryMock,
    );
  });

  describe('create', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should create safes for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());
      const chainId = faker.number.int().toString();
      const payload = [{ address: addr(), chainId }];

      spacesRepositoryMock.findOne.mockResolvedValue(spaceBuilder().build());

      await service.create({ spaceId, authPayload, payload });

      expect(spacesRepositoryMock.findOne).toHaveBeenCalled();
      expect(spaceSafesRepositoryMock.create).toHaveBeenCalledWith({
        spaceId,
        payload,
      });
    });

    it('should throw when not authenticated', async () => {
      await expect(
        service.create({
          spaceId: faker.number.int(),
          authPayload: new AuthPayload(),
          payload: [],
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(spacesRepositoryMock.findOne).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should throw when %s user is not admin',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        spacesRepositoryMock.findOne.mockResolvedValue(null);

        await expect(
          service.create({
            spaceId: faker.number.int(),
            authPayload,
            payload: [],
          }),
        ).rejects.toThrow(ForbiddenException);
      },
    );
  });

  describe('get', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should return safes for %s member',
      async (_label, builder) => {
        const spaceId = faker.number.int();
        const authPayload = new AuthPayload(builder().build());
        const chainId1 = faker.number.int().toString();
        const chainId2 = faker.number.int().toString();
        const addr1 = addr();
        const addr2 = addr();
        const addr3 = addr();

        membersRepositoryMock.findOne.mockResolvedValue(
          memberBuilder().build(),
        );
        spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
          { chainId: chainId1, address: addr1 },
          { chainId: chainId1, address: addr2 },
          { chainId: chainId2, address: addr3 },
        ]);

        const result = await service.get(spaceId, authPayload);

        expect(membersRepositoryMock.findOne).toHaveBeenCalled();
        expect(result).toEqual({
          safes: {
            [chainId1]: [addr1, addr2],
            [chainId2]: [addr3],
          },
        });
      },
    );

    it('should throw when not authenticated', async () => {
      await expect(
        service.get(faker.number.int(), new AuthPayload()),
      ).rejects.toThrow(UnauthorizedException);

      expect(spaceSafesRepositoryMock.findBySpaceId).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should throw when %s user is not a member',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        membersRepositoryMock.findOne.mockResolvedValue(null);

        await expect(
          service.get(faker.number.int(), authPayload),
        ).rejects.toThrow(ForbiddenException);

        expect(spaceSafesRepositoryMock.findBySpaceId).not.toHaveBeenCalled();
      },
    );
  });

  describe('delete', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)('should delete safes for %s admin', async (_label, builder) => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(builder().build());
      const chainId = faker.number.int().toString();
      const payload = [{ address: addr(), chainId }];

      spacesRepositoryMock.findOne.mockResolvedValue(spaceBuilder().build());

      await service.delete({ spaceId, authPayload, payload });

      expect(spacesRepositoryMock.findOne).toHaveBeenCalled();
      expect(spaceSafesRepositoryMock.delete).toHaveBeenCalledWith({
        spaceId,
        payload,
      });
    });

    it('should throw when not authenticated', async () => {
      await expect(
        service.delete({
          spaceId: faker.number.int(),
          authPayload: new AuthPayload(),
          payload: [],
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(spacesRepositoryMock.findOne).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should throw when %s user is not admin',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        spacesRepositoryMock.findOne.mockResolvedValue(null);

        await expect(
          service.delete({
            spaceId: faker.number.int(),
            authPayload,
            payload: [],
          }),
        ).rejects.toThrow(ForbiddenException);
      },
    );
  });
});
