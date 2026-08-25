// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { QuotaExceededError } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { spaceBuilder } from '@/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import type { ISpacesRepository } from '@/modules/spaces/domain/spaces.repository.interface';
import { SpaceSafesService } from '@/modules/spaces/routes/safes/space-safes.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const addr = (): Address => getAddress(faker.finance.ethereumAddress());

const spaceSafesRepositoryMock = {
  create: vi.fn(),
  findBySpaceId: vi.fn(),
  delete: vi.fn(),
} as MockedObject<ISpaceSafesRepository>;

const spacesRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<ISpacesRepository>;

const membersRepositoryMock = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

const entitlementEnforcementMock = {
  assertWithinQuota: vi.fn(),
  prepareQuotaCheck: vi.fn(),
} as MockedObject<IEntitlementEnforcement>;

describe('SpaceSafesService', () => {
  let service: SpaceSafesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new SpaceSafesService(
      spaceSafesRepositoryMock,
      spacesRepositoryMock,
      membersRepositoryMock,
      entitlementEnforcementMock,
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
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(vi.fn());

      await service.create({ spaceId, authPayload, payload });

      expect(spacesRepositoryMock.findOne).toHaveBeenCalled();
      expect(spaceSafesRepositoryMock.create).toHaveBeenCalledWith({
        spaceId,
        actorUserId: Number(authPayload.sub),
        payload,
        assertSeats: expect.any(Function),
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

    it('prepares the seat check for the whole batch and hands it to the write', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const payload = [
        { address: addr(), chainId: faker.number.int().toString() },
        { address: addr(), chainId: faker.number.int().toString() },
      ];
      const used = faker.number.int({ min: 1, max: 5 });
      const check = vi.fn();
      spacesRepositoryMock.findOne.mockResolvedValue(spaceBuilder().build());
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(check);
      // Stands in for the repository, which counts under the space's lock.
      spaceSafesRepositoryMock.create.mockImplementation(({ assertSeats }) => {
        assertSeats(used);
        return Promise.resolve();
      });

      await service.create({ spaceId, authPayload, payload });

      expect(
        entitlementEnforcementMock.prepareQuotaCheck,
      ).toHaveBeenCalledExactlyOnceWith({
        spaceId,
        featureKey: 'safe_seats',
        delta: payload.length,
      });
      expect(check).toHaveBeenCalledExactlyOnceWith(used);
    });

    it('propagates a seat rejection raised inside the write', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      spacesRepositoryMock.findOne.mockResolvedValue(spaceBuilder().build());
      const quota = faker.number.int({ min: 5, max: 10 });
      const quotaExceeded = new QuotaExceededError({
        feature: 'safe_seats',
        quota,
        used: quota,
        resetsAt: null,
      });
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(() => {
        throw quotaExceeded;
      });
      spaceSafesRepositoryMock.create.mockImplementation(({ assertSeats }) => {
        assertSeats(quota);
        return Promise.resolve();
      });

      await expect(
        service.create({
          spaceId: faker.number.int(),
          authPayload,
          payload: [
            { address: addr(), chainId: faker.number.int().toString() },
          ],
        }),
      ).rejects.toThrow(quotaExceeded);
    });
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
        actorUserId: Number(authPayload.sub),
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
