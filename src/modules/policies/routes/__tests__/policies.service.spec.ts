// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { PolicyAssembler } from '@/modules/policies/domain/assemblers/policy-assembler.interface';
import { SpendingLimitAssembler } from '@/modules/policies/domain/assemblers/spending-limit.assembler';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import { policyIndexerStateBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { indexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import type { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const mockPolicyIndexerRepository = {
  getState: vi.fn(),
  clearState: vi.fn(),
} as MockedObject<IPolicyIndexerRepository>;

const mockConfigurationRequestsRepository = {
  create: vi.fn(),
} as unknown as MockedObject<IPolicyConfigurationRequestsRepository>;

const mockSafeRepository = {
  getSafe: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

const mockSpaceSafesRepository = {
  findBySpaceId: vi.fn(),
} as unknown as MockedObject<ISpaceSafesRepository>;

const mockMembersRepository = {
  findOne: vi.fn(),
} as unknown as MockedObject<IMembersRepository>;

const SEPOLIA = '11155111';

describe('PoliciesService', () => {
  let target: PoliciesService;
  let assemblers: Array<PolicyAssembler>;
  const spaceId = faker.number.int({ min: 1, max: 100 });
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const allowanceModule = getAddress(faker.finance.ethereumAddress());
  const userId = faker.number.int({ min: 1, max: 100 });
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
  );
  const spaceRequest = { spaceId, authPayload };

  beforeEach(() => {
    assemblers = [new SpendingLimitAssembler()];
    target = new PoliciesService(
      mockPolicyIndexerRepository,
      mockConfigurationRequestsRepository,
      mockSafeRepository,
      mockSpaceSafesRepository,
      mockMembersRepository,
      assemblers,
    );

    // authorised by default: active member, Safe in the space
    mockMembersRepository.findOne.mockResolvedValue({ id: 1 } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId: SEPOLIA, address: safeAddress },
    ] as never);
    mockSafeRepository.getSafe.mockResolvedValue(
      safeBuilder().with('modules', [allowanceModule]).build(),
    );
    mockPolicyIndexerRepository.getState.mockResolvedValue(
      policyIndexerStateBuilder().build(),
    );
    mockConfigurationRequestsRepository.create.mockResolvedValue();
  });

  function allowanceOf(safe: string) {
    return indexerSafeAllowanceBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', getAddress(safe))
      .with('module', allowanceModule)
      .with('amount', '1000')
      .with('spent', '0')
      .with('remaining', '1000')
      .build();
  }

  describe('authorisation', () => {
    it('should reject an unauthenticated caller', async () => {
      await expect(
        target.getSpaceActivePolicies({
          ...spaceRequest,
          authPayload: new AuthPayload(undefined),
        }),
      ).rejects.toThrow('Not authenticated');
      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
    });

    it('should match a requested safe recorded in the space in another casing', async () => {
      // The Space stores what the client sent; a casing difference must not read
      // as a Safe outside the Space.
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA, address: safeAddress.toLowerCase() },
      ] as never);

      await expect(
        target.getSpaceActivePolicies({
          ...spaceRequest,
          safes: [{ chainId: SEPOLIA, address: safeAddress }],
        }),
      ).resolves.toMatchObject({ count: 0 });
    });
  });

  describe('reading the state', () => {
    it('should read the safes of the space', async () => {
      await target.getSpaceActivePolicies(spaceRequest);

      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });
    });

    it('should return the policies its assemblers built', async () => {
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerStateBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const result = await target.getSpaceActivePolicies(spaceRequest);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        type: PolicyType.SpendingLimit,
        enabled: true,
      });
    });

    it('should give an assembler only the rows of the safe it is assembling', async () => {
      // The indexer answers for every Safe of a request, so an unscoped
      // assembler would report another Safe's limits on this one.
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerStateBuilder()
          .with('allowances', [allowanceOf(faker.finance.ethereumAddress())])
          .build(),
      );

      const result = await target.getSpaceActivePolicies(spaceRequest);

      expect(result.results).toStrictEqual([]);
    });

    it('should report a policy as unenforced when its module is not enabled', async () => {
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('modules', []).build(),
      );
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerStateBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const result = await target.getSpaceActivePolicies(spaceRequest);

      expect(result.results[0].enabled).toBe(false);
    });

    it('should treat a safe with no modules as having none enabled', async () => {
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('modules', null).build(),
      );
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerStateBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const result = await target.getSpaceActivePolicies(spaceRequest);

      expect(result.results[0].enabled).toBe(false);
    });

    it('should return no policies for a safe that has none', async () => {
      await expect(
        target.getSpaceActivePolicies(spaceRequest),
      ).resolves.toMatchObject({ count: 0, results: [] });
    });

    it('should fail the request when the indexer read fails', async () => {
      // Atomic: a page that says what controls a Safe must not answer "nothing"
      // where the answer is "unknown".
      mockPolicyIndexerRepository.getState.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(target.getSpaceActivePolicies(spaceRequest)).rejects.toThrow(
        'Service unavailable',
      );
    });

    it('should fail the request when the safe cannot be read', async () => {
      mockSafeRepository.getSafe.mockRejectedValue(new Error('Not found'));

      await expect(target.getSpaceActivePolicies(spaceRequest)).rejects.toThrow(
        'Not found',
      );
    });
  });

  describe('across a space', () => {
    const otherSafe = getAddress(faker.finance.ethereumAddress());

    beforeEach(() => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA, address: safeAddress },
        { chainId: '137', address: otherSafe },
      ] as never);
    });

    it('should read every safe of the space in one indexer call', async () => {
      // The request count must not grow with the size of the Space.
      await target.getSpaceActivePolicies({
        spaceId,
        authPayload,
      });

      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledTimes(1);
      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [
          { chainId: SEPOLIA, address: safeAddress },
          { chainId: '137', address: otherSafe },
        ],
      });
    });

    it('should carry the safe on every item, so nothing merges across chains', async () => {
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerStateBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const page = await target.getSpaceActivePolicies({
        spaceId,
        authPayload,
      });

      expect(page.results).toHaveLength(1);
      expect(page.results[0].safe).toStrictEqual({
        chainId: SEPOLIA,
        address: safeAddress,
      });
    });

    it('should return a page envelope', async () => {
      const page = await target.getSpaceActivePolicies({
        spaceId,
        authPayload,
      });

      expect(page).toStrictEqual({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
    });

    it('should narrow the read to the requested subset', async () => {
      await target.getSpaceActivePolicies({
        spaceId,
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
        authPayload,
      });

      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });
    });

    it('should reject a requested safe that is not in the space', async () => {
      // Narrowing to nothing would look like a Space whose Safes hold no
      // policies, rather than a request for a Safe the caller cannot read.
      const outsider = getAddress(faker.finance.ethereumAddress());

      await expect(
        target.getSpaceActivePolicies({
          spaceId,
          safes: [{ chainId: SEPOLIA, address: outsider }],
          authPayload,
        }),
      ).rejects.toThrow(`Safe ${SEPOLIA}:${outsider} is not in this space`);
      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
    });

    it('should reject a caller who is not a member of the space', async () => {
      mockMembersRepository.findOne.mockResolvedValue(null as never);

      await expect(
        target.getSpaceActivePolicies({
          spaceId,
          authPayload,
        }),
      ).rejects.toThrow('User is not a member of this workspace');
    });

    it('should read nothing for a space with no safes', async () => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([] as never);

      const page = await target.getSpaceActivePolicies({
        spaceId,
        authPayload,
      });

      expect(page.results).toStrictEqual([]);
      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
    });

    it('should fail the whole request when one safe cannot be read', async () => {
      // Atomic: one unhealthy chain fails the page rather than dropping a Safe
      // from it silently.
      mockSafeRepository.getSafe.mockRejectedValueOnce(
        new Error('Service unavailable'),
      );

      await expect(
        target.getSpaceActivePolicies({
          spaceId,
          authPayload,
        }),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('storing a configuration request', () => {
    const request = {
      spaceId,
      safeId: { chainId: SEPOLIA, address: safeAddress },
      authPayload,
    };

    /** A payload whose root is the hash of its configurations. */
    function validPayload(): {
      root: Hex;
      configurations: [PolicyConfiguration, ...Array<PolicyConfiguration>];
    } {
      const configurations: [PolicyConfiguration] = [
        policyConfigurationBuilder().build(),
      ];
      return { root: configurationRoot(configurations), configurations };
    }

    it('should store the configurations of a root', async () => {
      const payload = validPayload();

      await expect(
        target.createConfigurationRequest({ ...request, payload }),
      ).resolves.toStrictEqual({ configureRoot: payload.root });
      expect(mockConfigurationRequestsRepository.create).toHaveBeenCalledWith({
        chainId: SEPOLIA,
        safeAddress,
        root: payload.root,
        configurations: payload.configurations,
        spaceId,
        createdBy: userId,
      });
    });

    it('should reject configurations that do not hash to the root', async () => {
      // A client encoding bug; storing it would explain nothing.
      const payload = validPayload();

      await expect(
        target.createConfigurationRequest({
          ...request,
          payload: { ...payload, root: `0x${'11'.repeat(32)}` as Hex },
        }),
      ).rejects.toThrow('The configurations do not hash to the given root');
      expect(mockConfigurationRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should store an upper-cased root under its canonical casing', async () => {
      // Otherwise a retry in another casing is a second row for one request.
      const payload = validPayload();
      const upperCased = payload.root.toUpperCase().replace('0X', '0x');

      await expect(
        target.createConfigurationRequest({
          ...request,
          payload: { ...payload, root: upperCased as `0x${string}` },
        }),
      ).resolves.toStrictEqual({ configureRoot: payload.root });
      expect(mockConfigurationRequestsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ root: payload.root }),
      );
    });

    it('should reject a caller who is not a member of the space', async () => {
      mockMembersRepository.findOne.mockResolvedValue(null as never);

      await expect(
        target.createConfigurationRequest({
          ...request,
          payload: validPayload(),
        }),
      ).rejects.toThrow('User is not a member of this workspace');
      expect(mockConfigurationRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should reject a safe that is not in the space', async () => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([] as never);

      await expect(
        target.createConfigurationRequest({
          ...request,
          payload: validPayload(),
        }),
      ).rejects.toThrow(new NotFoundException('Safe not found in this space'));
    });
  });
});
