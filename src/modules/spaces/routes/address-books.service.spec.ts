// SPDX-License-Identifier: FSL-1.1-MIT
import { AddressBooksService } from '@/modules/spaces/routes/address-books.service';
import type { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import {
  siweAuthPayloadDtoBuilder,
  oidcAuthPayloadDtoBuilder,
} from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { addressBookItemBuilder } from '@/modules/spaces/domain/address-books/entities/__tests__/address-book-item.db.builder';
import { getAddress } from 'viem';

const repositoryMock = {
  findAllBySpaceId: jest.fn(),
  upsertMany: jest.fn(),
  deleteByAddress: jest.fn(),
} as jest.MockedObjectDeep<IAddressBookItemsRepository>;

const configurationServiceMock = {
  getOrThrow: jest.fn().mockReturnValue(20),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('AddressBooksService', () => {
  let service: AddressBooksService;

  beforeEach(() => {
    jest.resetAllMocks();
    configurationServiceMock.getOrThrow.mockReturnValue(20);
    service = new AddressBooksService(repositoryMock, configurationServiceMock);
  });

  describe('findAllBySpaceId', () => {
    it.each([
      ['SIWE', siweAuthPayloadDtoBuilder],
      ['OIDC', oidcAuthPayloadDtoBuilder],
    ] as const)(
      'should return address book items for %s user',
      async (_label, builder) => {
        const spaceId = faker.number.int();
        const authPayload = new AuthPayload(builder().build());
        const items = [addressBookItemBuilder().build()];
        repositoryMock.findAllBySpaceId.mockResolvedValue(items);

        const result = await service.findAllBySpaceId(authPayload, spaceId);

        expect(result.spaceId).toBe(spaceId.toString());
        expect(result.data).toHaveLength(1);
        expect(repositoryMock.findAllBySpaceId).toHaveBeenCalledWith({
          authPayload,
          spaceId,
        });
      },
    );

    it('should throw for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();
      repositoryMock.findAllBySpaceId.mockRejectedValue(
        new UnauthorizedException('Not authenticated'),
      );

      await expect(
        service.findAllBySpaceId(authPayload, spaceId),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('upsertMany', () => {
    it('should upsert items for SIWE user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      const items = [addressBookItemBuilder().build()];
      repositoryMock.upsertMany.mockResolvedValue(items);

      const result = await service.upsertMany(authPayload, spaceId, {
        items: items.map((i) => ({
          address: i.address,
          name: i.name,
          chainIds: i.chainIds,
        })),
      });

      expect(result.spaceId).toBe(spaceId.toString());
      expect(result.data).toHaveLength(1);
      expect(repositoryMock.upsertMany).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for OIDC user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());

      await expect(
        service.upsertMany(authPayload, spaceId, { items: [] }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Address book writes require wallet authentication',
        ),
      );
      expect(repositoryMock.upsertMany).not.toHaveBeenCalled();
    });

    it('should throw for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const authPayload = new AuthPayload();

      await expect(
        service.upsertMany(authPayload, spaceId, { items: [] }),
      ).rejects.toThrow(ForbiddenException);
      expect(repositoryMock.upsertMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteByAddress', () => {
    it('should delete for SIWE user', async () => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());
      repositoryMock.deleteByAddress.mockResolvedValue();

      await service.deleteByAddress({ authPayload, spaceId, address });

      expect(repositoryMock.deleteByAddress).toHaveBeenCalledWith({
        authPayload,
        spaceId,
        address,
      });
    });

    it('should throw ForbiddenException for OIDC user', async () => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload(oidcAuthPayloadDtoBuilder().build());

      await expect(
        service.deleteByAddress({ authPayload, spaceId, address }),
      ).rejects.toThrow(
        new ForbiddenException(
          'Address book writes require wallet authentication',
        ),
      );
      expect(repositoryMock.deleteByAddress).not.toHaveBeenCalled();
    });

    it('should throw for unauthenticated user', async () => {
      const spaceId = faker.number.int();
      const address = getAddress(faker.finance.ethereumAddress());
      const authPayload = new AuthPayload();

      await expect(
        service.deleteByAddress({ authPayload, spaceId, address }),
      ).rejects.toThrow(ForbiddenException);
      expect(repositoryMock.deleteByAddress).not.toHaveBeenCalled();
    });
  });
});
