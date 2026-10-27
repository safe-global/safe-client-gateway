// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Equal } from 'typeorm';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { PostgresDatabaseService } from '#/datasources/db/v2/postgres-database.service';
import {
  oidcAuthPayloadDtoBuilder,
  siweAuthPayloadDtoBuilder,
} from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { IEntitlementEnforcement } from '#/modules/entitlements/domain/entitlement-enforcement.interface';
import { QuotaExceededError } from '#/modules/entitlements/domain/errors/quota-exceeded.error';
import type { IAddressBookItemsRepository } from '#/modules/spaces/domain/address-books/address-book-items.repository.interface';
import { spaceBuilder } from '#/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import type { PreparedSpaceSafe } from '#/modules/spaces/domain/safes/entities/space-safe.entity';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { SpaceSafesService } from '#/modules/spaces/routes/safes/space-safes.service';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { Member } from '#/modules/users/domain/entities/member.entity';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

const addr = (): Address => getAddress(faker.finance.ethereumAddress());

/** What `encryptRows` hands back with encryption disabled. */
const preparedRow = (spaceId: number, address: Address): PreparedSpaceSafe => ({
  space: { id: spaceId },
  chainId: faker.number.int().toString(),
  address,
  addressIndex: null,
  plaintextAddress: address,
});

const spaceSafesRepositoryMock = {
  encryptRows: vi.fn(),
  lockSeats: vi.fn(),
  countSeatsBySpaceId: vi.fn(),
  countNewSeats: vi.fn(),
  insertRows: vi.fn(),
  findBySpaceId: vi.fn(),
  findBySpaceIds: vi.fn(),
  delete: vi.fn(),
} as MockedObject<ISpaceSafesRepository>;

const entityManager = {} as EntityManager;

const postgresDatabaseServiceMock = {
  transaction: vi.fn((fn: (em: EntityManager) => Promise<unknown>) =>
    fn(entityManager),
  ),
} as MockedObject<PostgresDatabaseService>;

const membersRepositoryMock = {
  findOne: vi.fn(),
  find: vi.fn(),
} as MockedObject<IMembersRepository>;

const adminMember = (): Member =>
  memberBuilder().with('role', 'ADMIN').with('status', 'ACTIVE').build();

const addressBookItemsRepositoryMock = {
  upsertMany: vi.fn(),
} as MockedObject<IAddressBookItemsRepository>;

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
      membersRepositoryMock,
      entitlementEnforcementMock,
      postgresDatabaseServiceMock,
      addressBookItemsRepositoryMock,
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
      // Opaque to the service: whatever `encryptRows` returned reaches
      // `insertRows` untouched.
      const rows = [
        {
          space: { id: spaceId },
          chainId,
          address: payload[0].address,
          addressIndex: null,
          plaintextAddress: payload[0].address,
        },
      ];

      membersRepositoryMock.findOne.mockResolvedValue(adminMember());
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(vi.fn());
      spaceSafesRepositoryMock.encryptRows.mockResolvedValue(rows);
      spaceSafesRepositoryMock.countSeatsBySpaceId.mockResolvedValue(0);
      spaceSafesRepositoryMock.countNewSeats.mockResolvedValue(1);

      await service.create({ spaceId, authPayload, payload });

      expect(membersRepositoryMock.findOne).toHaveBeenCalled();
      expect(
        spaceSafesRepositoryMock.lockSeats,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, entityManager);
      expect(
        spaceSafesRepositoryMock.insertRows,
      ).toHaveBeenCalledExactlyOnceWith({
        spaceId,
        actorUserId: Number(authPayload.sub),
        rows,
        entityManager,
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

      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should throw when %s user is not admin',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        membersRepositoryMock.findOne.mockResolvedValue(null);

        await expect(
          service.create({
            spaceId: faker.number.int(),
            authPayload,
            payload: [],
          }),
        ).rejects.toThrow(ForbiddenException);
      },
    );

    it('admits the seat change the write measures, under the lock', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const payload = [
        { address: addr(), chainId: faker.number.int().toString() },
        { address: addr(), chainId: faker.number.int().toString() },
      ];
      const seats = {
        used: faker.number.int({ min: 1, max: 5 }),
        delta: 1,
      };

      const check = vi.fn();
      const rows = payload.map(({ address }) => preparedRow(spaceId, address));
      membersRepositoryMock.findOne.mockResolvedValue(adminMember());
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(check);
      spaceSafesRepositoryMock.encryptRows.mockResolvedValue(rows);
      spaceSafesRepositoryMock.countSeatsBySpaceId.mockResolvedValue(
        seats.used,
      );
      spaceSafesRepositoryMock.countNewSeats.mockResolvedValue(seats.delta);

      await service.create({ spaceId, authPayload, payload });

      expect(
        entitlementEnforcementMock.prepareQuotaCheck,
      ).toHaveBeenCalledExactlyOnceWith({
        spaceId,
        featureKey: 'safe_seats',
      });
      // Measured in the caller's transaction, so the count the check admits is
      // the state the insert lands on.
      expect(
        spaceSafesRepositoryMock.countSeatsBySpaceId,
      ).toHaveBeenCalledExactlyOnceWith(spaceId, entityManager);
      expect(
        spaceSafesRepositoryMock.countNewSeats,
      ).toHaveBeenCalledExactlyOnceWith(
        { spaceId, addresses: payload.map(({ address }) => address) },
        entityManager,
      );
      expect(check).toHaveBeenCalledExactlyOnceWith(seats);
      expect(spaceSafesRepositoryMock.insertRows).toHaveBeenCalledOnce();
    });

    it('takes no seat for another chain of a Safe the Workspace holds', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const payload = [
        { address: addr(), chainId: faker.number.int().toString() },
      ];
      const quota = faker.number.int({ min: 1, max: 5 });
      const check = vi.fn();
      membersRepositoryMock.findOne.mockResolvedValue(adminMember());
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(check);
      spaceSafesRepositoryMock.encryptRows.mockResolvedValue(
        payload.map(({ address }) => preparedRow(spaceId, address)),
      );
      // At the limit, and the row adds no address the Workspace lacks.
      spaceSafesRepositoryMock.countSeatsBySpaceId.mockResolvedValue(quota);
      spaceSafesRepositoryMock.countNewSeats.mockResolvedValue(0);

      await service.create({ spaceId, authPayload, payload });

      expect(check).toHaveBeenCalledExactlyOnceWith({
        used: quota,
        delta: 0,
      });
      expect(spaceSafesRepositoryMock.insertRows).toHaveBeenCalledOnce();
    });

    it('propagates a seat rejection raised inside the write', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      membersRepositoryMock.findOne.mockResolvedValue(adminMember());
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
      const payload = [
        { address: addr(), chainId: faker.number.int().toString() },
      ];
      spaceSafesRepositoryMock.encryptRows.mockResolvedValue(
        payload.map(({ address }) => preparedRow(spaceId, address)),
      );
      spaceSafesRepositoryMock.countSeatsBySpaceId.mockResolvedValue(quota);
      spaceSafesRepositoryMock.countNewSeats.mockResolvedValue(1);

      await expect(
        service.create({ spaceId, authPayload, payload }),
      ).rejects.toThrow(quotaExceeded);

      expect(spaceSafesRepositoryMock.insertRows).not.toHaveBeenCalled();
    });
  });

  describe('create with addressBookItems', () => {
    const arrange = (): {
      spaceId: number;
      authPayload: AuthPayload;
      payload: Array<{ address: Address; chainId: string }>;
      addressBookItems: Array<{
        name: string;
        address: Address;
        chainIds: Array<string>;
      }>;
    } => {
      const spaceId = faker.number.int();
      const address = addr();
      const chainId = faker.number.int().toString();
      membersRepositoryMock.findOne.mockResolvedValue(adminMember());
      entitlementEnforcementMock.prepareQuotaCheck.mockResolvedValue(vi.fn());
      spaceSafesRepositoryMock.encryptRows.mockResolvedValue([
        preparedRow(spaceId, address),
      ]);
      spaceSafesRepositoryMock.countSeatsBySpaceId.mockResolvedValue(0);
      spaceSafesRepositoryMock.countNewSeats.mockResolvedValue(1);
      return {
        spaceId,
        authPayload: new AuthPayload(oidcAuthPayloadDtoBuilder().build()),
        payload: [{ address, chainId }],
        addressBookItems: [
          { name: faker.word.noun(), address, chainIds: [chainId] },
        ],
      };
    };

    it('writes the names after the Safes, in the same transaction', async () => {
      const { spaceId, authPayload, payload, addressBookItems } = arrange();

      await service.create({ spaceId, authPayload, payload, addressBookItems });

      expect(
        addressBookItemsRepositoryMock.upsertMany,
      ).toHaveBeenCalledExactlyOnceWith({
        userId: Number(authPayload.sub),
        spaceId,
        addressBookItems,
        entityManager,
      });
      expect(
        spaceSafesRepositoryMock.insertRows.mock.invocationCallOrder[0],
      ).toBeLessThan(
        addressBookItemsRepositoryMock.upsertMany.mock.invocationCallOrder[0],
      );
    });

    it.each([
      ['absent', undefined],
      ['empty', []],
    ])('writes no names when they are %s', async (_label, items) => {
      const { spaceId, authPayload, payload } = arrange();

      await service.create({
        spaceId,
        authPayload,
        payload,
        addressBookItems: items,
      });

      expect(addressBookItemsRepositoryMock.upsertMany).not.toHaveBeenCalled();
    });

    it('writes no names when the Safes are not added', async () => {
      const { spaceId, authPayload, payload, addressBookItems } = arrange();
      spaceSafesRepositoryMock.insertRows.mockRejectedValue(new Error('boom'));

      await expect(
        service.create({ spaceId, authPayload, payload, addressBookItems }),
      ).rejects.toThrow('boom');

      expect(addressBookItemsRepositoryMock.upsertMany).not.toHaveBeenCalled();
    });

    it('fails the whole write when the names fail, so the Safes roll back with them', async () => {
      const { spaceId, authPayload, payload, addressBookItems } = arrange();
      const error = new Error('kms down');
      addressBookItemsRepositoryMock.upsertMany.mockRejectedValue(error);

      await expect(
        service.create({ spaceId, authPayload, payload, addressBookItems }),
      ).rejects.toBe(error);

      // Both writes ran on the transaction's manager, so its rollback undoes the insert.
      expect(spaceSafesRepositoryMock.insertRows).toHaveBeenCalledWith(
        expect.objectContaining({ entityManager }),
      );
      expect(postgresDatabaseServiceMock.transaction).toHaveBeenCalledOnce();
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

  describe('getAll', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should return the safes of every space of a %s member, one entry per space grouped by chain',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        const space1 = spaceBuilder().build();
        const space2 = spaceBuilder().build();
        const [chainId1, chainId2] = faker.helpers.uniqueArray(
          () => faker.number.int().toString(),
          2,
        );
        const [addr1, addr2, addr3, addr4] = [addr(), addr(), addr(), addr()];

        membersRepositoryMock.find.mockResolvedValue([
          memberBuilder().with('space', space1).build(),
          memberBuilder().with('space', space2).build(),
        ]);
        spaceSafesRepositoryMock.findBySpaceIds.mockResolvedValue(
          new Map([
            [
              space1.id,
              [
                { chainId: chainId1, address: addr1 },
                { chainId: chainId1, address: addr2 },
                { chainId: chainId2, address: addr3 },
              ],
            ],
            [space2.id, [{ chainId: chainId2, address: addr4 }]],
          ]),
        );

        const result = await service.getAll(authPayload);

        expect(membersRepositoryMock.find).toHaveBeenCalledExactlyOnceWith({
          select: { id: true, space: { id: true, uuid: true } },
          where: { user: Equal(Number(authPayload.sub)), status: 'ACTIVE' },
          relations: { space: true },
        });
        expect(
          spaceSafesRepositoryMock.findBySpaceIds,
        ).toHaveBeenCalledExactlyOnceWith([space1.id, space2.id]);
        expect(result).toStrictEqual([
          {
            spaceUuid: space1.uuid,
            safes: { [chainId1]: [addr1, addr2], [chainId2]: [addr3] },
          },
          { spaceUuid: space2.uuid, safes: { [chainId2]: [addr4] } },
        ]);
      },
    );

    it('should return empty safes for a space without safes', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const space = spaceBuilder().build();

      membersRepositoryMock.find.mockResolvedValue([
        memberBuilder().with('space', space).build(),
      ]);
      spaceSafesRepositoryMock.findBySpaceIds.mockResolvedValue(
        new Map([[space.id, []]]),
      );

      await expect(service.getAll(authPayload)).resolves.toStrictEqual([
        { spaceUuid: space.uuid, safes: {} },
      ]);
    });

    it('should return an empty array when the user is a member of no space', async () => {
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());

      membersRepositoryMock.find.mockResolvedValue([]);
      spaceSafesRepositoryMock.findBySpaceIds.mockResolvedValue(new Map());

      await expect(service.getAll(authPayload)).resolves.toStrictEqual([]);
      expect(
        spaceSafesRepositoryMock.findBySpaceIds,
      ).toHaveBeenCalledExactlyOnceWith([]);
    });

    it('should throw when not authenticated', async () => {
      await expect(service.getAll(new AuthPayload())).rejects.toThrow(
        UnauthorizedException,
      );

      expect(membersRepositoryMock.find).not.toHaveBeenCalled();
      expect(spaceSafesRepositoryMock.findBySpaceIds).not.toHaveBeenCalled();
    });
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

      membersRepositoryMock.findOne.mockResolvedValue(adminMember());

      await service.delete({ spaceId, authPayload, payload });

      expect(membersRepositoryMock.findOne).toHaveBeenCalled();
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

      expect(membersRepositoryMock.findOne).not.toHaveBeenCalled();
    });

    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should throw when %s user is not admin',
      async (_label, builder) => {
        const authPayload = new AuthPayload(builder().build());
        membersRepositoryMock.findOne.mockResolvedValue(null);

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
