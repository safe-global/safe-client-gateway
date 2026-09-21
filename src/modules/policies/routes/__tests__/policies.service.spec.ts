// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import type { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type { ActivePolicy } from '@/modules/policies/domain/entities/active-policy.entity';
import { DelegateApiVersion } from '@/modules/policies/domain/entities/delegate-api-version.entity';
import { policyIndexerResponseBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { policyIndexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const mockPolicyIndexerRepository = {
  getState: vi.fn(),
  clearState: vi.fn(),
} as MockedObject<IPolicyIndexerRepository>;

const mockSafeRepository = {
  getSafe: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

const mockSpaceSafesRepository = {
  findBySpaceId: vi.fn(),
} as unknown as MockedObject<ISpaceSafesRepository>;

const mockMembersRepository = {
  findOne: vi.fn(),
} as unknown as MockedObject<IMembersRepository>;

const mockDelegatesV2Repository = {
  getDelegates: vi.fn(),
} as unknown as MockedObject<IDelegatesV2Repository>;

const mockDelegatesV3Repository = {
  getDelegates: vi.fn(),
} as unknown as MockedObject<IDelegatesV3Repository>;

const SEPOLIA = '11155111';

describe('PoliciesService', () => {
  let target: PoliciesService;
  const spaceId = faker.number.int({ min: 1, max: 100 });
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const allowanceModule = getAddress(faker.finance.ethereumAddress());
  const userId = faker.number.int({ min: 1, max: 100 });
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
  );
  const policyRequest = {
    spaceId,
    authPayload,
    types: Object.values(PolicyType),
  };

  beforeEach(() => {
    target = new PoliciesService(
      mockPolicyIndexerRepository,
      mockSafeRepository,
      mockSpaceSafesRepository,
      mockMembersRepository,
      mockDelegatesV2Repository,
      mockDelegatesV3Repository,
      new SpendingLimitMapper(),
      new ProposerMapper(),
    );

    // authorised by default: active member, Safe in the space
    mockMembersRepository.findOne.mockResolvedValue(memberBuilder().build());
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId: SEPOLIA, address: safeAddress },
    ]);
    mockSafeRepository.getSafe.mockResolvedValue(
      safeBuilder().with('modules', [allowanceModule]).build(),
    );
    mockPolicyIndexerRepository.getState.mockResolvedValue(
      policyIndexerResponseBuilder().build(),
    );
    // No proposers unless a case registers some.
    withDelegates([], []);
  });

  /** Reports `v2` and `v3` as the registrations each delegates API holds. */
  function withDelegates(v2: Array<Delegate>, v3: Array<Delegate>): void {
    mockDelegatesV2Repository.getDelegates.mockResolvedValue(
      pageBuilder<Delegate>().with('results', v2).build(),
    );
    mockDelegatesV3Repository.getDelegates.mockResolvedValue(
      pageBuilder<Delegate>().with('results', v3).build(),
    );
  }

  /** An allowance of `safe` on `allowanceModule`, spendable by default. */
  function allowanceOf(safe: string): PolicyIndexerSafeAllowance {
    return policyIndexerSafeAllowanceBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', getAddress(safe))
      .with('module', allowanceModule)
      .with('amount', '1000')
      .with('spent', '0')
      .with('remaining', '1000')
      .build();
  }

  /** The policies of the Space, over the given allowance rows. */
  async function activePolicies(
    allowances: Array<PolicyIndexerSafeAllowance>,
  ): Promise<Array<ActivePolicy>> {
    mockPolicyIndexerRepository.getState.mockResolvedValue(
      policyIndexerResponseBuilder().with('allowances', allowances).build(),
    );

    return await target.getSpaceActivePolicies(policyRequest);
  }

  /** Reports `modules` as the ones the Safe has enabled. */
  function withEnabledModules(modules: Array<Address>): void {
    mockSafeRepository.getSafe.mockResolvedValue(
      safeBuilder().with('modules', modules).build(),
    );
  }

  describe('authorisation', () => {
    it('should reject an unauthenticated caller', async () => {
      await expect(
        target.getSpaceActivePolicies({
          ...policyRequest,
          authPayload: new AuthPayload(undefined),
        }),
      ).rejects.toThrow('Not authenticated');
      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
    });

    it('should match a requested safe recorded in the space in another casing', async () => {
      // The Space stores what the client sent; a casing difference must not read
      // as a Safe outside the Space.
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA, address: safeAddress.toLowerCase() as Address },
      ]);

      await expect(
        target.getSpaceActivePolicies({
          ...policyRequest,
          safes: [{ chainId: SEPOLIA, address: safeAddress }],
        }),
      ).resolves.toStrictEqual([]);
    });
  });

  describe('reading the state', () => {
    it('should read the safes of the space', async () => {
      await target.getSpaceActivePolicies(policyRequest);

      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });
    });

    it('should return the policies it built', async () => {
      const result = await activePolicies([allowanceOf(safeAddress)]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: PolicyType.SpendingLimit,
        enabled: true,
      });
    });

    it('should use only the rows of the safe it is building', async () => {
      // The indexer answers for every Safe of a request, so an unscoped read
      // would report another Safe's limits on this one.
      const result = await activePolicies([
        allowanceOf(faker.finance.ethereumAddress()),
      ]);

      expect(result).toStrictEqual([]);
    });

    it('should report a policy as unenforced when its module is not enabled', async () => {
      withEnabledModules([]);

      const result = await activePolicies([allowanceOf(safeAddress)]);

      expect(result[0].enabled).toBe(false);
    });

    it('should treat a safe with no modules as having none enabled', async () => {
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('modules', null).build(),
      );

      const result = await activePolicies([allowanceOf(safeAddress)]);

      expect(result[0].enabled).toBe(false);
    });

    it('should return no policies for a safe that has none', async () => {
      await expect(
        target.getSpaceActivePolicies(policyRequest),
      ).resolves.toStrictEqual([]);
    });

    it('should fail the request when the indexer read fails', async () => {
      // Atomic: a page that says what controls a Safe must not answer "nothing"
      // where the answer is "unknown".
      mockPolicyIndexerRepository.getState.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(
        target.getSpaceActivePolicies(policyRequest),
      ).rejects.toThrow('Service unavailable');
    });

    it('should fail the request when the safe cannot be read', async () => {
      mockSafeRepository.getSafe.mockRejectedValue(new Error('Not found'));

      await expect(
        target.getSpaceActivePolicies(policyRequest),
      ).rejects.toThrow('Not found');
    });
  });

  describe('across a space', () => {
    const otherSafe = getAddress(faker.finance.ethereumAddress());

    beforeEach(() => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA, address: safeAddress },
        { chainId: '137', address: otherSafe },
      ]);
    });

    it('should read every safe of the space in one indexer call', async () => {
      // The request count must not grow with the size of the Space.
      await target.getSpaceActivePolicies({
        ...policyRequest,
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
        policyIndexerResponseBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
      });

      expect(policies).toHaveLength(1);
      expect(policies[0].safe).toStrictEqual({
        chainId: SEPOLIA,
        address: safeAddress,
      });
    });

    it('should narrow the read to the requested subset', async () => {
      await target.getSpaceActivePolicies({
        ...policyRequest,
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });

      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });
    });

    it('should read a safe requested more than once only once', async () => {
      // A repeated `?safes=` entry - the same Safe in another casing included -
      // is one Safe, not two: duplicating it would duplicate its policies in
      // the response and read the Safe twice.
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
        safes: [
          { chainId: SEPOLIA, address: safeAddress },
          { chainId: SEPOLIA, address: getAddress(safeAddress.toLowerCase()) },
        ],
      });

      expect(policies).toHaveLength(1);
      expect(mockPolicyIndexerRepository.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });
      expect(mockSafeRepository.getSafe).toHaveBeenCalledTimes(1);
    });

    it('should reject a requested safe that is not in the space', async () => {
      // Narrowing to nothing would look like a Space whose Safes hold no
      // policies, rather than a request for a Safe the caller cannot read.
      const outsider = getAddress(faker.finance.ethereumAddress());

      await expect(
        target.getSpaceActivePolicies({
          ...policyRequest,
          safes: [{ chainId: SEPOLIA, address: outsider }],
        }),
      ).rejects.toThrow(`Safe ${SEPOLIA}:${outsider} is not in this space`);
      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
    });

    it('should reject a caller who is not a member of the space', async () => {
      mockMembersRepository.findOne.mockResolvedValue(null);

      await expect(
        target.getSpaceActivePolicies({
          ...policyRequest,
        }),
      ).rejects.toThrow('User is not a member of this workspace');
    });

    it('should read nothing for a space with no safes', async () => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([]);

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
      });

      expect(policies).toStrictEqual([]);
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
          ...policyRequest,
        }),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('proposers', () => {
    it('should read both delegates apis for the safe, at the max page size', async () => {
      // The Transaction Service's default page would silently truncate a Safe
      // with many proposers.
      await target.getSpaceActivePolicies(policyRequest);

      const expected = {
        chainId: SEPOLIA,
        safeAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
      };
      expect(mockDelegatesV2Repository.getDelegates).toHaveBeenCalledWith(
        expected,
      );
      expect(mockDelegatesV3Repository.getDelegates).toHaveBeenCalledWith(
        expected,
      );
    });

    it('should report no proposer policy when neither api holds a registration', async () => {
      const policies = await target.getSpaceActivePolicies(policyRequest);

      expect(policies).toStrictEqual([]);
    });

    it('should report one policy per api that holds a registration', async () => {
      const onV2 = delegateBuilder().with('safe', safeAddress).build();
      const onV3 = delegateBuilder().with('safe', safeAddress).build();
      withDelegates([onV2], [onV3]);

      const policies = await target.getSpaceActivePolicies(policyRequest);

      expect(policies).toMatchObject([
        {
          type: PolicyType.Proposer,
          safe: { chainId: SEPOLIA, address: safeAddress },
          data: {
            version: DelegateApiVersion.V2,
            proposers: [{ proposer: onV2.delegate }],
          },
        },
        {
          type: PolicyType.Proposer,
          data: {
            version: DelegateApiVersion.V3,
            proposers: [{ proposer: onV3.delegate }],
          },
        },
      ]);
    });

    it('should report proposers alongside the spending limits of the same safe', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()], []);

      const policies = await activePolicies([allowanceOf(safeAddress)]);

      expect(policies.map((policy) => policy.type)).toStrictEqual([
        PolicyType.SpendingLimit,
        PolicyType.Proposer,
      ]);
    });

    it('should fail the whole request when a delegates read fails', async () => {
      // Same atomicity as the rest of the page: a Safe whose proposers could
      // not be read must not report as having none.
      mockDelegatesV3Repository.getDelegates.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(
        target.getSpaceActivePolicies(policyRequest),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('narrowing by policy type', () => {
    it('should report every type when every type is requested', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()], []);

      const policies = await activePolicies([allowanceOf(safeAddress)]);

      expect(policies.map((policy) => policy.type)).toStrictEqual([
        PolicyType.SpendingLimit,
        PolicyType.Proposer,
      ]);
    });

    it('should report only the spending limits when only they are asked for', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()], []);
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.SpendingLimit],
      });

      expect(policies.map((policy) => policy.type)).toStrictEqual([
        PolicyType.SpendingLimit,
      ]);
    });

    it('should not read the delegates apis when proposers are not asked for', async () => {
      // Filtering by skipping the read, not by dropping the result - the point
      // of the filter is the call that is never made.
      await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.SpendingLimit],
      });

      expect(mockDelegatesV2Repository.getDelegates).not.toHaveBeenCalled();
      expect(mockDelegatesV3Repository.getDelegates).not.toHaveBeenCalled();
    });

    it('should not read the indexer or the safe when spending limits are not asked for', async () => {
      await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.Proposer],
      });

      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
      expect(mockSafeRepository.getSafe).not.toHaveBeenCalled();
    });

    it('should report both types when both are asked for', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()], []);
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.Proposer, PolicyType.SpendingLimit],
      });

      expect(policies.map((policy) => policy.type)).toStrictEqual([
        PolicyType.SpendingLimit,
        PolicyType.Proposer,
      ]);
    });

    it('should read nothing for a type it does not report yet', async () => {
      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.Recovery],
      });

      expect(policies).toStrictEqual([]);
      expect(mockPolicyIndexerRepository.getState).not.toHaveBeenCalled();
      expect(mockDelegatesV2Repository.getDelegates).not.toHaveBeenCalled();
    });
  });
});
