// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { counterfactualSafeBuilder } from '@/modules/counterfactual-safes/datasources/entities/__tests__/counterfactual-safe.entity.db.builder';
import type { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { SpaceCounterfactualSafesService } from '@/modules/counterfactual-safes/routes/space-counterfactual-safes.service';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const mockMembersRepository = vi.mocked({
  findOne: vi.fn(),
} as unknown as MockedObject<IMembersRepository>);

const mockSpaceSafesRepository = vi.mocked({
  findBySpaceId: vi.fn(),
} as unknown as MockedObject<ISpaceSafesRepository>);

const mockCounterfactualSafesRepository = vi.mocked({
  find: vi.fn(),
} as unknown as MockedObject<ICounterfactualSafesRepository>);

const mockSafeRepository = vi.mocked({
  isSafe: vi.fn(),
} as unknown as MockedObject<ISafeRepository>);

describe('SpaceCounterfactualSafesService', () => {
  let target: SpaceCounterfactualSafesService;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new SpaceCounterfactualSafesService(
      mockMembersRepository,
      mockSpaceSafesRepository,
      mockCounterfactualSafesRepository,
      mockSafeRepository,
    );
  });

  const spaceId = faker.string.uuid();
  const authPayloadDto = siweAuthPayloadDtoBuilder().build();
  const userId = Number(authPayloadDto.sub);
  const authPayload = new AuthPayload(authPayloadDto);

  it('excludes counterfactual rows whose Safe is already deployed on-chain', async () => {
    const chainId = '11155111';
    const deployed = counterfactualSafeBuilder()
      .with('chainId', chainId)
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();
    const undeployed = counterfactualSafeBuilder()
      .with('chainId', chainId)
      .with('address', getAddress(faker.finance.ethereumAddress()))
      .build();

    mockMembersRepository.findOne.mockResolvedValue({
      id: userId,
    } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId, address: deployed.address },
      { chainId, address: undeployed.address },
    ]);
    mockCounterfactualSafesRepository.find.mockResolvedValue([
      deployed,
      undeployed,
    ]);
    mockSafeRepository.isSafe.mockImplementation(
      async ({ address }) => address === deployed.address,
    );

    const result = await target.get(spaceId as never, authPayload);

    const returned = result.safes[chainId] ?? [];
    expect(returned).toHaveLength(1);
    expect(returned[0].address).toBe(undeployed.address);
  });

  it('returns undeployed counterfactual safes', async () => {
    const chainId = '11155111';
    const undeployed = counterfactualSafeBuilder()
      .with('chainId', chainId)
      .build();

    mockMembersRepository.findOne.mockResolvedValue({
      id: userId,
    } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId, address: undeployed.address },
    ]);
    mockCounterfactualSafesRepository.find.mockResolvedValue([undeployed]);
    mockSafeRepository.isSafe.mockResolvedValue(false);

    const result = await target.get(spaceId as never, authPayload);

    expect(result.safes[chainId]).toHaveLength(1);
  });

  it('keeps the Safe when the deployment check fails (fail open)', async () => {
    const chainId = '11155111';
    const safe = counterfactualSafeBuilder().with('chainId', chainId).build();

    mockMembersRepository.findOne.mockResolvedValue({ id: userId } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId, address: safe.address },
    ]);
    mockCounterfactualSafesRepository.find.mockResolvedValue([safe]);
    mockSafeRepository.isSafe.mockRejectedValue(new Error('tx service down'));

    const result = await target.get(spaceId as never, authPayload);

    expect(result.safes[chainId]).toHaveLength(1);
    expect(result.safes[chainId][0].address).toBe(safe.address);
  });

  it('returns no safes and skips lookups when the space has no safes', async () => {
    mockMembersRepository.findOne.mockResolvedValue({ id: userId } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([]);

    const result = await target.get(spaceId as never, authPayload);

    expect(result).toEqual({ safes: {} });
    expect(mockCounterfactualSafesRepository.find).not.toHaveBeenCalled();
    expect(mockSafeRepository.isSafe).not.toHaveBeenCalled();
  });

  it('throws when the user is not a member of the space', async () => {
    mockMembersRepository.findOne.mockResolvedValue(null as never);

    await expect(target.get(spaceId as never, authPayload)).rejects.toThrow();
    expect(mockSpaceSafesRepository.findBySpaceId).not.toHaveBeenCalled();
  });

  it('filters deployed safes per chain across multiple chains', async () => {
    const chainA = '1';
    const chainB = '11155111';
    const deployedA = counterfactualSafeBuilder().with('chainId', chainA).build();
    const undeployedA = counterfactualSafeBuilder()
      .with('chainId', chainA)
      .build();
    const undeployedB = counterfactualSafeBuilder()
      .with('chainId', chainB)
      .build();

    mockMembersRepository.findOne.mockResolvedValue({ id: userId } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId: chainA, address: deployedA.address },
      { chainId: chainA, address: undeployedA.address },
      { chainId: chainB, address: undeployedB.address },
    ]);
    mockCounterfactualSafesRepository.find.mockResolvedValue([
      deployedA,
      undeployedA,
      undeployedB,
    ]);
    mockSafeRepository.isSafe.mockImplementation(
      async ({ address }) => address === deployedA.address,
    );

    const result = await target.get(spaceId as never, authPayload);

    expect(result.safes[chainA]).toHaveLength(1);
    expect(result.safes[chainA][0].address).toBe(undeployedA.address);
    expect(result.safes[chainB]).toHaveLength(1);
    expect(result.safes[chainB][0].address).toBe(undeployedB.address);
  });
});
