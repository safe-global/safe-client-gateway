// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { type Address, getAddress } from 'viem';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/space-safes.repository.interface';
import { NestedSafesGraphService } from '@/modules/spaces/routes/nested-safes-graph.service';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members.repository.interface';

const addr = (): Address => getAddress(faker.finance.ethereumAddress());

const safeRepositoryMock = {
  getSafesByOwner: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>;

const spaceSafesRepositoryMock = {
  findBySpaceId: jest.fn(),
} as jest.MockedObjectDeep<ISpaceSafesRepository>;

const membersRepositoryMock = {
  findOne: jest.fn(),
} as jest.MockedObjectDeep<IMembersRepository>;

describe('NestedSafesGraphService', () => {
  let service: NestedSafesGraphService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new NestedSafesGraphService(
      safeRepositoryMock,
      spaceSafesRepositoryMock,
      membersRepositoryMock,
    );
  });

  it('throws when not authenticated', async () => {
    await expect(
      service.get({
        spaceId: faker.number.int(),
        chainId: '1',
        authPayload: new AuthPayload(),
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws when caller is not a member', async () => {
    membersRepositoryMock.findOne.mockResolvedValue(null);
    await expect(
      service.get({
        spaceId: faker.number.int(),
        chainId: '1',
        authPayload: new AuthPayload(siweAuthPayloadDtoBuilder().build()),
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(spaceSafesRepositoryMock.findBySpaceId).not.toHaveBeenCalled();
  });

  it('seeds from member safes on the requested chain only and expands one level', async () => {
    const chainId = '1';
    const a = addr();
    const b = addr();
    const otherChainSafe = addr();
    membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
    spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
      { chainId, address: a },
      { chainId: '137', address: otherChainSafe },
    ]);
    safeRepositoryMock.getSafesByOwner.mockImplementation(({ ownerAddress }) =>
      Promise.resolve(ownerAddress === a ? { safes: [b] } : { safes: [] }),
    );

    const result = await service.get({
      spaceId: faker.number.int(),
      chainId,
      authPayload: new AuthPayload(siweAuthPayloadDtoBuilder().build()),
    });

    expect(result.chainId).toBe(chainId);
    expect(result.nodes.map((n) => n.address.toLowerCase()).sort()).toEqual(
      [a.toLowerCase(), b.toLowerCase()].sort(),
    );
    // otherChainSafe (chain 137) is NOT a seed when chainId=1
    expect(
      result.nodes.find(
        (n) => n.address.toLowerCase() === otherChainSafe.toLowerCase(),
      ),
    ).toBeUndefined();
    expect(
      result.nodes.find((n) => n.address.toLowerCase() === a.toLowerCase())
        ?.isSpaceMember,
    ).toBe(true);
    expect(
      result.nodes.find((n) => n.address.toLowerCase() === a.toLowerCase())
        ?.trust,
    ).toBe('trusted');
    expect(
      result.nodes.find((n) => n.address.toLowerCase() === b.toLowerCase())
        ?.trust,
    ).toBe('unknown');
    expect(result.edges).toEqual([{ from: a, to: b }]);
  });

  it('returns an empty graph when the space has no safes on the chain', async () => {
    membersRepositoryMock.findOne.mockResolvedValue(memberBuilder().build());
    spaceSafesRepositoryMock.findBySpaceId.mockResolvedValue([
      { chainId: '137', address: addr() },
    ]);

    const result = await service.get({
      spaceId: faker.number.int(),
      chainId: '1',
      authPayload: new AuthPayload(siweAuthPayloadDtoBuilder().build()),
    });

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(safeRepositoryMock.getSafesByOwner).not.toHaveBeenCalled();
  });
});
