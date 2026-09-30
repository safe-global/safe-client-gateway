// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import {
  SAFE_QUEUE_SERVICE_MAX_LIMIT,
  SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
} from '@/domain/common/constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  addDelegateEncoder,
  deleteAllowanceEncoder,
  resetAllowanceEncoder,
  setAllowanceEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/allowance-module-encoder.builder';
import { AllowanceModuleDecoder } from '@/modules/contracts/domain/decoders/allowance-module-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import type { IDelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository.interface';
import type {
  ActivePolicy,
  SpendingLimitAllowance,
  SpendingLimitPolicyData,
} from '@/modules/policies/domain/entities/active-policy.entity';
import { policyIndexerResponseBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { policyIndexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import type { PolicyIndexerSafeAllowance } from '@/modules/policies/domain/entities/indexer/policy-indexer-state.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import type { IPolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository.interface';
import { PendingSpendingLimitMapper } from '@/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { ProposerMapper } from '@/modules/policies/routes/mappers/proposer.mapper';
import { SpendingLimitMapper } from '@/modules/policies/routes/mappers/spending-limit.mapper';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import {
  erc20TokenBuilder,
  erc721TokenBuilder,
} from '@/modules/tokens/domain/__tests__/token.builder';
import type { ITokenRepository } from '@/modules/tokens/domain/token.repository.interface';
import { memberBuilder } from '@/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

const mockPolicyIndexerRepository = {
  getState: vi.fn(),
  clearState: vi.fn(),
} as MockedObject<IPolicyIndexerRepository>;

const mockSafeRepository = {
  getSafe: vi.fn(),
  getTransactionQueue: vi.fn(),
  getTransactionQueueMaxPageSize: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

const mockSpaceSafesRepository = {
  findBySpaceId: vi.fn(),
} as unknown as MockedObject<ISpaceSafesRepository>;

const mockMembersRepository = {
  findOne: vi.fn(),
} as unknown as MockedObject<IMembersRepository>;

const mockDelegatesV3Repository = {
  getDelegates: vi.fn(),
} as MockedObject<IDelegatesV3Repository>;

const mockTokenRepository = {
  getToken: vi.fn(),
  getTokens: vi.fn(),
} as MockedObject<ITokenRepository>;

const mockChainsRepository = {
  getChain: vi.fn(),
} as unknown as MockedObject<IChainsRepository>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

function pendingSpendingLimitMapper(): PendingSpendingLimitMapper {
  return new PendingSpendingLimitMapper(
    new MultiSendDecoder(mockLoggingService),
    new SafeDecoder(),
    new AllowanceModuleDecoder(),
  );
}

const SEPOLIA = '11155111';

describe('PoliciesService', () => {
  let target: PoliciesService;
  const spaceId = faker.number.int({ min: 1, max: 100 });
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const allowanceModule = getAddress(faker.finance.ethereumAddress());
  const userId = faker.number.int({ min: 1, max: 100 });
  const batchSize = faker.number.int({ min: 1, max: 5 });
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
  );
  const policyRequest = {
    spaceId,
    authPayload,
    types: Object.values(PolicyType),
  };

  beforeEach(() => {
    target = policiesService(batchSize);

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
    // Default token metadata, unless a case sets its own.
    mockTokenRepository.getToken.mockResolvedValue(erc20TokenBuilder().build());
    mockChainsRepository.getChain.mockResolvedValue(chainBuilder().build());
    // No proposers unless a case registers some.
    withDelegates([]);
  });

  /**
   * The service, reading the delegates - or the enabled modules - of
   * {@link size} safes at a time.
   */
  function policiesService(
    size: number,
    args?: { safeQueueServiceEnabled?: boolean },
  ): PoliciesService {
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('policies.batchSize', size);
    mockSafeRepository.getTransactionQueueMaxPageSize.mockReturnValue(
      args?.safeQueueServiceEnabled
        ? SAFE_QUEUE_SERVICE_MAX_LIMIT
        : SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
    );

    return new PoliciesService(
      mockPolicyIndexerRepository,
      mockSafeRepository,
      mockSpaceSafesRepository,
      mockMembersRepository,
      mockDelegatesV3Repository,
      mockTokenRepository,
      mockChainsRepository,
      fakeConfigurationService,
      mockLoggingService,
      new SpendingLimitMapper(),
      new ProposerMapper(),
      pendingSpendingLimitMapper(),
    );
  }

  /** Reports {@link delegates} as the registrations the delegates API holds. */
  function withDelegates(delegates: Array<Delegate>): void {
    mockDelegatesV3Repository.getDelegates.mockResolvedValue(
      pageBuilder<Delegate>().with('results', delegates).build(),
    );
  }

  /**
   * An allowance of `safe` on `allowanceModule`, spendable by default.
   * `overrides.token`/`overrides.delegate` default to the builder's own
   * random values when not given.
   */
  function allowanceOf(
    safe: string,
    overrides: { token?: Address; delegate?: Address } = {},
  ): PolicyIndexerSafeAllowance {
    let builder = policyIndexerSafeAllowanceBuilder()
      .with('chainId', SEPOLIA)
      .with('safe', getAddress(safe))
      .with('module', allowanceModule)
      .with('amount', '1000')
      .with('spent', '0')
      .with('remaining', '1000');

    if (overrides.token) {
      builder = builder.with('token', overrides.token);
    }
    if (overrides.delegate) {
      builder = builder.with('delegate', overrides.delegate);
    }

    return builder.build();
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

  /** Every allowance across every spending-limit policy of `policies`. */
  function spendingLimitAllowances(
    policies: ReadonlyArray<ActivePolicy>,
  ): Array<SpendingLimitAllowance> {
    return policies
      .filter(
        (policy): policy is ActivePolicy & { data: SpendingLimitPolicyData } =>
          'spenders' in policy.data,
      )
      .flatMap((policy) => policy.data.spenders)
      .flatMap((spender) => spender.allowances);
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

    it('should skip the safe in the spending-limit results when its enabled modules cannot be read, and log it', async () => {
      mockSafeRepository.getSafe.mockRejectedValue(new Error('Not found'));

      const result = await activePolicies([allowanceOf(safeAddress)]);

      expect(result).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: SEPOLIA,
          safeAddress,
        }),
      );
    });
  });

  describe('resolving token metadata', () => {
    it('should attach the fetched metadata to the allowance', async () => {
      const token = erc20TokenBuilder().build();
      mockTokenRepository.getToken.mockResolvedValue(token);

      const result = await activePolicies([allowanceOf(safeAddress)]);

      const [allowance] = spendingLimitAllowances(result);
      expect(allowance.tokenMetadata).toStrictEqual(token);
    });

    it('should fetch a token shared by two spenders only once', async () => {
      const sharedToken = getAddress(faker.finance.ethereumAddress());

      await activePolicies([
        allowanceOf(safeAddress, { token: sharedToken }),
        allowanceOf(safeAddress, { token: sharedToken }),
      ]);

      expect(mockTokenRepository.getToken).toHaveBeenCalledTimes(1);
      expect(mockTokenRepository.getToken).toHaveBeenCalledWith({
        chainId: SEPOLIA,
        address: sharedToken,
      });
    });

    it('should resolve the native currency from the chain, not the token repository', async () => {
      const chain = chainBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);

      const result = await activePolicies([
        allowanceOf(safeAddress, { token: zeroAddress }),
      ]);

      const [allowance] = spendingLimitAllowances(result);
      expect(allowance.tokenMetadata).toStrictEqual({
        type: 'NATIVE_TOKEN',
        address: zeroAddress,
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals,
        logoUri: chain.nativeCurrency.logoUri,
        trusted: true,
      });
      expect(mockTokenRepository.getToken).not.toHaveBeenCalledWith(
        expect.objectContaining({ address: zeroAddress }),
      );
    });

    it('should fetch a chain shared by two safes only once', async () => {
      const otherSafeOnSepolia = getAddress(faker.finance.ethereumAddress());
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA, address: safeAddress },
        { chainId: SEPOLIA, address: otherSafeOnSepolia },
      ]);
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('allowances', [
            allowanceOf(safeAddress, { token: zeroAddress }),
            allowanceOf(otherSafeOnSepolia, { token: zeroAddress }),
          ])
          .build(),
      );

      await target.getSpaceActivePolicies(policyRequest);

      expect(mockChainsRepository.getChain).toHaveBeenCalledTimes(1);
      expect(mockChainsRepository.getChain).toHaveBeenCalledWith(SEPOLIA);
    });

    it('should report a null token rather than fail the request when the lookup fails', async () => {
      mockTokenRepository.getToken.mockRejectedValue(new Error('Not found'));

      const result = await activePolicies([allowanceOf(safeAddress)]);

      const [allowance] = spendingLimitAllowances(result);
      expect(allowance.tokenMetadata).toBeNull();
    });

    it('should report a null token rather than an ERC721', async () => {
      mockTokenRepository.getToken.mockResolvedValue(
        erc721TokenBuilder().build(),
      );

      const result = await activePolicies([allowanceOf(safeAddress)]);

      const [allowance] = spendingLimitAllowances(result);
      expect(allowance.tokenMetadata).toBeNull();
    });

    it('should report a null native-currency token when the chain cannot be read', async () => {
      mockChainsRepository.getChain.mockRejectedValue(new Error('Not found'));

      const result = await activePolicies([
        allowanceOf(safeAddress, { token: zeroAddress }),
      ]);

      const [allowance] = spendingLimitAllowances(result);
      expect(allowance.tokenMetadata).toBeNull();
    });

    it('should fetch no token metadata for a proposers-only request', async () => {
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('allowances', [allowanceOf(safeAddress)])
          .build(),
      );

      await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.Proposer],
      });

      expect(mockTokenRepository.getToken).not.toHaveBeenCalled();
      expect(mockChainsRepository.getChain).not.toHaveBeenCalled();
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

    it('should report the safes except the one whose modules cannot be retrived', async () => {
      const otherSafeAllowance = policyIndexerSafeAllowanceBuilder()
        .with('chainId', '137')
        .with('safe', otherSafe)
        .with('module', allowanceModule)
        .with('amount', '1000')
        .with('spent', '0')
        .with('remaining', '1000')
        .build();
      mockPolicyIndexerRepository.getState.mockResolvedValue(
        policyIndexerResponseBuilder()
          .with('allowances', [allowanceOf(safeAddress), otherSafeAllowance])
          .build(),
      );
      mockSafeRepository.getSafe.mockImplementation((args) =>
        args.address === safeAddress
          ? Promise.reject(new Error('Service unavailable'))
          : Promise.resolve(
              safeBuilder().with('modules', [allowanceModule]).build(),
            ),
      );

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
      });

      expect(policies).toMatchObject([
        { type: PolicyType.SpendingLimit, safe: { address: otherSafe } },
      ]);
    });

    it('should report the proposers except the one whose delegates cannot be retrieved', async () => {
      const registeredOnOther = delegateBuilder()
        .with('safe', otherSafe)
        .build();
      mockDelegatesV3Repository.getDelegates.mockImplementation((args) =>
        args.safeAddress === safeAddress
          ? Promise.reject(new Error('Service unavailable'))
          : Promise.resolve(
              pageBuilder<Delegate>()
                .with('results', [registeredOnOther])
                .build(),
            ),
      );

      const policies = await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.Proposer],
      });

      expect(policies).toMatchObject([
        {
          type: PolicyType.Proposer,
          safe: { address: otherSafe },
          data: { proposers: [{ proposer: registeredOnOther.delegate }] },
        },
      ]);
    });
  });

  describe('proposers', () => {
    it('should read the delegates api for the safe, at the Queue Service max page size when the queue service flag is set true', async () => {
      target = policiesService(batchSize, { safeQueueServiceEnabled: true });

      await target.getSpaceActivePolicies(policyRequest);

      expect(mockDelegatesV3Repository.getDelegates).toHaveBeenCalledWith({
        chainId: SEPOLIA,
        safeAddress,
        limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
      });
    });

    it('should read the delegates api for the safe, at the Transaction Service max page size when the queue service flag is set false', async () => {
      target = policiesService(batchSize, { safeQueueServiceEnabled: false });

      await target.getSpaceActivePolicies(policyRequest);

      expect(mockDelegatesV3Repository.getDelegates).toHaveBeenCalledWith({
        chainId: SEPOLIA,
        safeAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
      });
    });

    it('should report no proposer policy when no registration is held', async () => {
      const policies = await target.getSpaceActivePolicies(policyRequest);

      expect(policies).toStrictEqual([]);
    });

    it('should report one policy holding the registrations of the safe', async () => {
      const registered = delegateBuilder().with('safe', safeAddress).build();
      withDelegates([registered]);

      const policies = await target.getSpaceActivePolicies(policyRequest);

      expect(policies).toMatchObject([
        {
          type: PolicyType.Proposer,
          safe: { chainId: SEPOLIA, address: safeAddress },
          data: { proposers: [{ proposer: registered.delegate }] },
        },
      ]);
    });

    it('should report proposers alongside the spending limits of the same safe', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()]);

      const policies = await activePolicies([allowanceOf(safeAddress)]);

      expect(policies.map((policy) => policy.type)).toStrictEqual([
        PolicyType.SpendingLimit,
        PolicyType.Proposer,
      ]);
    });

    it('should skip the proposer policy when the delegates cannot be read, and log it', async () => {
      mockDelegatesV3Repository.getDelegates.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const policies = await target.getSpaceActivePolicies(policyRequest);

      expect(policies).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: SEPOLIA,
          safeAddress,
        }),
      );
    });
  });

  describe('batching the delegates reads', () => {
    const proposerRequest = {
      ...policyRequest,
      types: [PolicyType.Proposer],
    };

    /** Reports {@link addresses} as the safes the space holds, on Sepolia. */
    function withSpaceSafes(addresses: ReadonlyArray<Address>): void {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue(
        addresses.map((address) => ({ chainId: SEPOLIA, address })),
      );
    }

    function addresses(count: number): Array<Address> {
      return Array.from({ length: count }, () =>
        getAddress(faker.finance.ethereumAddress()),
      );
    }

    it('should report each safe the delegates read for it', async () => {
      // The batches are assembled back into one answer, so a safe read in the
      // second batch must not be reported the first batch's proposers.
      const safes = addresses(5);
      const registered = safes.map((safe) =>
        delegateBuilder().with('safe', safe).build(),
      );
      withSpaceSafes(safes);
      mockDelegatesV3Repository.getDelegates.mockImplementation((args) =>
        Promise.resolve(
          pageBuilder<Delegate>()
            .with(
              'results',
              registered.filter(
                (delegate) => delegate.safe === args.safeAddress,
              ),
            )
            .build(),
        ),
      );
      target = policiesService(2);

      const policies = await target.getSpaceActivePolicies(proposerRequest);

      expect(policies).toMatchObject(
        safes.map((address, index) => ({
          type: PolicyType.Proposer,
          safe: { chainId: SEPOLIA, address },
          data: { proposers: [{ proposer: registered[index].delegate }] },
        })),
      );
    });

    it('should read no more safes at once than the batch size', async () => {
      // An unbounded fan-out over a large space is what the Transaction
      // Service answers with 429.
      const safes = addresses(7);
      let inFlight = 0;
      let mostInFlight = 0;
      withSpaceSafes(safes);
      mockDelegatesV3Repository.getDelegates.mockImplementation(async () => {
        inFlight += 1;
        mostInFlight = Math.max(mostInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return pageBuilder<Delegate>().with('results', []).build();
      });
      target = policiesService(3);

      await target.getSpaceActivePolicies(proposerRequest);

      expect(mostInFlight).toBe(3);
      expect(mockDelegatesV3Repository.getDelegates).toHaveBeenCalledTimes(
        safes.length,
      );
    });
  });

  describe('narrowing by policy type', () => {
    it('should report every type when every type is requested', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()]);

      const policies = await activePolicies([allowanceOf(safeAddress)]);

      expect(policies.map((policy) => policy.type)).toStrictEqual([
        PolicyType.SpendingLimit,
        PolicyType.Proposer,
      ]);
    });

    it('should report only the spending limits when only they are asked for', async () => {
      withDelegates([delegateBuilder().with('safe', safeAddress).build()]);
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

    it('should not read the delegates api when proposers are not asked for', async () => {
      // Filtering by skipping the read, not by dropping the result - the point
      // of the filter is the call that is never made.
      await target.getSpaceActivePolicies({
        ...policyRequest,
        types: [PolicyType.SpendingLimit],
      });

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
      withDelegates([delegateBuilder().with('safe', safeAddress).build()]);
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
      expect(mockDelegatesV3Repository.getDelegates).not.toHaveBeenCalled();
    });
  });

  describe('pending policies', () => {
    // Sepolia's only AllowanceModule deployment, per
    // @safe-global/safe-modules-deployments - the mapper only recognises real,
    // published deployments, so a random address never matches.
    const SEPOLIA_ALLOWANCE_MODULE = getAddress(
      '0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134',
    );
    const pendingRequest = {
      ...policyRequest,
      types: [PolicyType.SpendingLimit],
    };

    /** Reports `transactions` as the whole (one-page) queue of the safe. */
    function withQueue(transactions: Array<MultisigTransaction>): void {
      mockSafeRepository.getTransactionQueue.mockResolvedValue(
        pageBuilder<MultisigTransaction>()
          .with('results', transactions)
          .with('next', null)
          .build(),
      );
    }

    beforeEach(() => {
      withQueue([]);
    });

    it('should reject an unauthenticated caller', async () => {
      await expect(
        target.getSpacePendingPolicies({
          ...pendingRequest,
          authPayload: new AuthPayload(undefined),
        }),
      ).rejects.toThrow('Not authenticated');
      expect(mockSafeRepository.getTransactionQueue).not.toHaveBeenCalled();
    });

    it('should read nothing for a space with no safes', async () => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([]);

      await expect(
        target.getSpacePendingPolicies(pendingRequest),
      ).resolves.toStrictEqual([]);
    });

    it('should read nothing when spending-limit is not requested', async () => {
      const policies = await target.getSpacePendingPolicies({
        ...policyRequest,
        types: [PolicyType.Proposer],
      });

      expect(policies).toStrictEqual([]);
      expect(mockSafeRepository.getTransactionQueue).not.toHaveBeenCalled();
    });

    it('should narrow the read to the requested subset', async () => {
      const otherSafe = getAddress(faker.finance.ethereumAddress());
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA, address: safeAddress },
        { chainId: SEPOLIA, address: otherSafe },
      ]);

      await target.getSpacePendingPolicies({
        ...pendingRequest,
        safes: [{ chainId: SEPOLIA, address: safeAddress }],
      });

      expect(mockSafeRepository.getTransactionQueue).toHaveBeenCalledTimes(1);
    });

    it('should detect a spending-limit change in the queue', async () => {
      const addDelegate = addDelegateEncoder();
      const addDelegateArgs = addDelegate.build();
      withQueue([
        multisigTransactionBuilder()
          .with('to', SEPOLIA_ALLOWANCE_MODULE)
          .with('operation', Operation.CALL)
          .with('data', addDelegate.encode())
          .build(),
      ]);

      const policies = await target.getSpacePendingPolicies(pendingRequest);

      expect(policies).toEqual([
        expect.objectContaining({
          kind: 'queued-transaction',
          type: PolicyType.SpendingLimit,
          data: {
            module: SEPOLIA_ALLOWANCE_MODULE,
            changes: [
              {
                kind: 'add-delegate',
                delegate: addDelegateArgs.delegate,
              },
            ],
          },
        }),
      ]);
    });

    it('should skip the safe in the pending results when its queue cannot be read, and log it', async () => {
      mockSafeRepository.getTransactionQueue.mockRejectedValue(
        new Error('Service unavailable'),
      );

      const policies = await target.getSpacePendingPolicies(pendingRequest);

      expect(policies).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: SEPOLIA,
          safeAddress,
        }),
      );
    });

    it('should skip the safe in the pending results when the safe itself cannot be read, and log it', async () => {
      mockSafeRepository.getSafe.mockRejectedValue(new Error('Not found'));

      const policies = await target.getSpacePendingPolicies(pendingRequest);

      expect(policies).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: SEPOLIA,
          safeAddress,
        }),
      );
    });

    it('should read the queue at the Transaction Service page size when the queue service flag is set false', async () => {
      target = policiesService(batchSize, { safeQueueServiceEnabled: false });

      await target.getSpacePendingPolicies(pendingRequest);

      expect(mockSafeRepository.getTransactionQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        }),
      );
    });

    it('should read the queue at the Queue Service page size when the queue service flag is set true', async () => {
      target = policiesService(batchSize, { safeQueueServiceEnabled: true });

      await target.getSpacePendingPolicies(pendingRequest);

      expect(mockSafeRepository.getTransactionQueue).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
        }),
      );
    });

    it('should read every page of a queue longer than one page', async () => {
      target = policiesService(batchSize, { safeQueueServiceEnabled: true });
      const addDelegate = addDelegateEncoder();
      const addDelegateArgs = addDelegate.build();
      const firstPage = Array.from(
        { length: SAFE_QUEUE_SERVICE_MAX_LIMIT },
        () => multisigTransactionBuilder().build(),
      );
      const changeOnSecondPage = multisigTransactionBuilder()
        .with('to', SEPOLIA_ALLOWANCE_MODULE)
        .with('operation', Operation.CALL)
        .with('data', addDelegate.encode())
        .build();
      mockSafeRepository.getTransactionQueue
        .mockResolvedValueOnce(
          pageBuilder<MultisigTransaction>()
            .with('results', firstPage)
            .with('next', faker.internet.url())
            .build(),
        )
        .mockResolvedValueOnce(
          pageBuilder<MultisigTransaction>()
            .with('results', [changeOnSecondPage])
            .with('next', null)
            .build(),
        );

      const policies = await target.getSpacePendingPolicies(pendingRequest);

      expect(mockSafeRepository.getTransactionQueue).toHaveBeenCalledTimes(2);
      expect(mockSafeRepository.getTransactionQueue).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ offset: 0 }),
      );
      expect(mockSafeRepository.getTransactionQueue).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ offset: SAFE_QUEUE_SERVICE_MAX_LIMIT }),
      );
      expect(policies).toEqual([
        expect.objectContaining({
          data: {
            module: SEPOLIA_ALLOWANCE_MODULE,
            changes: [
              { kind: 'add-delegate', delegate: addDelegateArgs.delegate },
            ],
          },
        }),
      ]);
    });

    it('should stop reading a queue at the page cap and warn', async () => {
      target = policiesService(batchSize, { safeQueueServiceEnabled: true });
      mockSafeRepository.getTransactionQueue.mockResolvedValue(
        pageBuilder<MultisigTransaction>()
          .with('results', [])
          .with('next', faker.internet.url())
          .build(),
      );

      await target.getSpacePendingPolicies(pendingRequest);

      expect(mockSafeRepository.getTransactionQueue).toHaveBeenCalledTimes(
        PoliciesService.MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN,
      );
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Truncated a Safe transaction queue at the page cap',
          chainId: SEPOLIA,
          safeAddress,
          pages: PoliciesService.MAX_TRANSACTION_QUEUE_PAGES_TO_SCAN,
        }),
      );
    });

    it('should read no more safes at once than the batch size', async () => {
      const safes = Array.from({ length: 7 }, () =>
        getAddress(faker.finance.ethereumAddress()),
      );
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue(
        safes.map((address) => ({ chainId: SEPOLIA, address })),
      );
      let inFlight = 0;
      let mostInFlight = 0;
      mockSafeRepository.getTransactionQueue.mockImplementation(async () => {
        inFlight += 1;
        mostInFlight = Math.max(mostInFlight, inFlight);
        await Promise.resolve();
        inFlight -= 1;
        return pageBuilder<MultisigTransaction>()
          .with('results', [])
          .with('next', null)
          .build();
      });
      target = policiesService(3);

      await target.getSpacePendingPolicies(pendingRequest);

      expect(mostInFlight).toBe(3);
      expect(mockSafeRepository.getTransactionQueue).toHaveBeenCalledTimes(
        safes.length,
      );
    });

    describe('token metadata', () => {
      it('should attach the fetched metadata to a decoded setAllowance change', async () => {
        const setAllowance = setAllowanceEncoder();
        const setAllowanceArgs = setAllowance.build();
        const token = erc20TokenBuilder()
          .with('address', setAllowanceArgs.token)
          .build();
        mockTokenRepository.getToken.mockResolvedValue(token);
        withQueue([
          multisigTransactionBuilder()
            .with('to', SEPOLIA_ALLOWANCE_MODULE)
            .with('operation', Operation.CALL)
            .with('data', setAllowance.encode())
            .build(),
        ]);

        const [policy] = await target.getSpacePendingPolicies(pendingRequest);

        expect(policy.data.changes).toStrictEqual([
          expect.objectContaining({
            kind: 'set-allowance',
            tokenMetadata: token,
          }),
        ]);
      });

      it('should fetch a token shared by two changes only once', async () => {
        const sharedToken = getAddress(faker.finance.ethereumAddress());
        const first = setAllowanceEncoder().with('token', sharedToken);
        const second = setAllowanceEncoder().with('token', sharedToken);
        withQueue([
          multisigTransactionBuilder()
            .with('to', SEPOLIA_ALLOWANCE_MODULE)
            .with('operation', Operation.CALL)
            .with('data', first.encode())
            .build(),
          multisigTransactionBuilder()
            .with('to', SEPOLIA_ALLOWANCE_MODULE)
            .with('operation', Operation.CALL)
            .with('data', second.encode())
            .build(),
        ]);

        await target.getSpacePendingPolicies(pendingRequest);

        expect(mockTokenRepository.getToken).toHaveBeenCalledTimes(1);
        expect(mockTokenRepository.getToken).toHaveBeenCalledWith({
          chainId: SEPOLIA,
          address: sharedToken,
        });
      });

      it('should resolve the native currency from the chain, not the token repository', async () => {
        const chain = chainBuilder().build();
        mockChainsRepository.getChain.mockResolvedValue(chain);
        const resetAllowance = resetAllowanceEncoder().with(
          'token',
          zeroAddress,
        );
        withQueue([
          multisigTransactionBuilder()
            .with('to', SEPOLIA_ALLOWANCE_MODULE)
            .with('operation', Operation.CALL)
            .with('data', resetAllowance.encode())
            .build(),
        ]);

        const [policy] = await target.getSpacePendingPolicies(pendingRequest);

        expect(policy.data.changes).toStrictEqual([
          expect.objectContaining({
            kind: 'reset-allowance',
            tokenMetadata: {
              type: 'NATIVE_TOKEN',
              address: zeroAddress,
              name: chain.nativeCurrency.name,
              symbol: chain.nativeCurrency.symbol,
              decimals: chain.nativeCurrency.decimals,
              logoUri: chain.nativeCurrency.logoUri,
              trusted: true,
            },
          }),
        ]);
        expect(mockTokenRepository.getToken).not.toHaveBeenCalled();
      });

      it('should report a null token rather than fail the request when the lookup fails', async () => {
        mockTokenRepository.getToken.mockRejectedValue(new Error('Not found'));
        const deleteAllowance = deleteAllowanceEncoder();
        withQueue([
          multisigTransactionBuilder()
            .with('to', SEPOLIA_ALLOWANCE_MODULE)
            .with('operation', Operation.CALL)
            .with('data', deleteAllowance.encode())
            .build(),
        ]);

        const [policy] = await target.getSpacePendingPolicies(pendingRequest);

        expect(policy.data.changes).toStrictEqual([
          expect.objectContaining({
            kind: 'delete-allowance',
            tokenMetadata: null,
          }),
        ]);
      });

      it('should not attach token metadata to a change with no token', async () => {
        const addDelegate = addDelegateEncoder();
        withQueue([
          multisigTransactionBuilder()
            .with('to', SEPOLIA_ALLOWANCE_MODULE)
            .with('operation', Operation.CALL)
            .with('data', addDelegate.encode())
            .build(),
        ]);

        const [policy] = await target.getSpacePendingPolicies(pendingRequest);

        expect(policy.data.changes[0]).not.toHaveProperty('tokenMetadata');
        expect(mockTokenRepository.getToken).not.toHaveBeenCalled();
        expect(mockChainsRepository.getChain).not.toHaveBeenCalled();
      });
    });
  });
});
