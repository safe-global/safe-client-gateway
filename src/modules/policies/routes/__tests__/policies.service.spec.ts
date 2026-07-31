// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { PolicyConfigurationRequest } from '@/modules/policies/datasources/entities/policy-configuration-request.entity.db';
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import {
  hexBuilder,
  policyConfirmationBuilder,
} from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyGroupBuilder } from '@/modules/policies/domain/entities/__tests__/policy-group.builder';
import { policyRootRequestBuilder } from '@/modules/policies/domain/entities/__tests__/policy-root-request.builder';
import type { Erc20TransferPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import type { PolicyGroup } from '@/modules/policies/domain/entities/policy-group.entity';
import { PolicyRootRequestStatus } from '@/modules/policies/domain/entities/policy-root-request.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import type { IPoliciesRepository } from '@/modules/policies/domain/policies.repository.interface';
import type { PolicyCacheService } from '@/modules/policies/domain/policy-cache.service';
import type { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
import type { IPolicyConfigurationRequestsRepository } from '@/modules/policies/domain/policy-configuration-requests.repository.interface';
import type {
  PolicyResolver,
  PolicyResolverContext,
  ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
import { toPolicyInfo } from '@/modules/policies/domain/utils/policy-configuration.utils';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import { PoliciesService } from '@/modules/policies/routes/policies.service';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { IAddressBookItemsRepository } from '@/modules/spaces/domain/address-books/address-book-items.repository.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';
import { NULL_ADDRESS } from '@/routes/common/constants';

const SEPOLIA_CHAIN_ID = '11155111';

/**
 * The Transaction Service's contract name for the ERC20 allowlist policy. A
 * policy is typed from this, never by matching its address against a CGW-held
 * map, so a confirmation's `policy` address is irrelevant to routing.
 */
const ERC20_TRANSFER_POLICY_TYPE = 'ERC20TransferPolicy';

const mockPoliciesRepository = {
  getPolicyGroups: vi.fn(),
  getRootRequests: vi.fn(),
} as MockedObject<IPoliciesRepository>;

const mockSafeRepository = {
  getSafe: vi.fn(),
} as MockedObject<ISafeRepository>;

const mockSpaceSafesRepository = {
  findBySpaceId: vi.fn(),
} as MockedObject<ISpaceSafesRepository>;

const mockAddressBookItemsRepository = {
  findAllBySpaceId: vi.fn(),
} as MockedObject<IAddressBookItemsRepository>;

const mockMembersRepository = {
  findOne: vi.fn(),
} as MockedObject<IMembersRepository>;

const mockPolicyCatalogueService = {
  get: vi.fn(),
} as MockedObject<PolicyCatalogueService>;

const mockConfigurationRequestsRepository = {
  create: vi.fn(),
  findBySafe: vi.fn(),
} as MockedObject<IPolicyConfigurationRequestsRepository>;

const mockPolicyCacheService = {
  clearPolicies: vi.fn(),
} as MockedObject<PolicyCacheService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

/**
 * Resolver double that echoes the groups it was given, so the service's routing
 * and Safe-level enrichment can be asserted in isolation.
 */
function resolverStub(type: PolicyType): MockedObject<PolicyResolver> {
  return {
    type,
    resolve: vi.fn(async ({ groups }: PolicyResolverContext) =>
      groups.map(
        (group: PolicyGroup): ResolvedPolicy => ({
          id: group.access,
          type,
          data: { allowlist: [] } as Erc20TransferPolicyData,
          groups: [group],
        }),
      ),
    ),
  } as unknown as MockedObject<PolicyResolver>;
}

describe('PoliciesService', () => {
  let service: PoliciesService;
  let erc20Resolver: MockedObject<PolicyResolver>;
  let cosignerResolver: MockedObject<PolicyResolver>;
  const spaceId = faker.number.int({ min: 1, max: 100 });
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const safeId = { chainId: SEPOLIA_CHAIN_ID, address: safeAddress };
  const userId = faker.number.int({ min: 1, max: 100 });
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
  );
  const request = { spaceId, safeId, authPayload };

  beforeEach(() => {
    vi.resetAllMocks();
    erc20Resolver = resolverStub(PolicyType.Erc20Transfer);
    cosignerResolver = resolverStub(PolicyType.Cosigner);
    service = new PoliciesService(
      mockPoliciesRepository,
      mockSafeRepository,
      mockSpaceSafesRepository,
      mockAddressBookItemsRepository,
      mockMembersRepository,
      mockConfigurationRequestsRepository,
      mockPolicyCatalogueService,
      mockPolicyCacheService,
      [erc20Resolver, cosignerResolver],
      mockLoggingService,
    );

    // authorised by default: active member, Safe in the space
    mockMembersRepository.findOne.mockResolvedValue({ id: 1 } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
    ] as never);
    mockAddressBookItemsRepository.findAllBySpaceId.mockResolvedValue([]);
    mockPoliciesRepository.getPolicyGroups.mockResolvedValue([]);
    mockPoliciesRepository.getRootRequests.mockResolvedValue([]);
    mockSafeRepository.getSafe.mockResolvedValue(safeBuilder().build());
    mockPolicyCatalogueService.get.mockReturnValue([]);
    mockConfigurationRequestsRepository.create.mockResolvedValue();
    mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([]);
    mockPolicyCacheService.clearPolicies.mockResolvedValue();
  });

  describe('authorisation', () => {
    it.each([
      ['getAvailablePolicies' as const],
      ['getActivePolicies' as const],
      ['getPendingPolicies' as const],
    ])('%s should reject a non member', async (method) => {
      mockMembersRepository.findOne.mockResolvedValue(null);

      await expect(service[method](request)).rejects.toThrow(
        'User is not a member of this workspace',
      );
    });

    it.each([
      ['getAvailablePolicies' as const],
      ['getActivePolicies' as const],
      ['getPendingPolicies' as const],
    ])('%s should reject a Safe that is not in the space', async (method) => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([]);

      await expect(service[method](request)).rejects.toThrow(
        new NotFoundException('Safe not found in this space'),
      );
    });

    it('should reject a Safe added to the space on another chain', async () => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: '1', address: safeAddress },
      ] as never);

      await expect(service.getActivePolicies(request)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should accept a Safe stored with a different address casing', async () => {
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
        { chainId: SEPOLIA_CHAIN_ID, address: safeAddress.toLowerCase() },
      ] as never);

      await expect(service.getActivePolicies(request)).resolves.toStrictEqual({
        items: [],
      });
    });

    it('should reject an unauthenticated caller', async () => {
      const unauthenticated = new AuthPayload(undefined);

      await expect(
        service.getActivePolicies({ ...request, authPayload: unauthenticated }),
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('getActivePolicies', () => {
    it('should route each group to the resolver of its policy type', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);

      const result = await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        groups: [policyGroupBuilder([confirmation])],
        names: new Map(),
      });
      expect(cosignerResolver.resolve).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        groups: [],
        names: new Map(),
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(PolicyType.Erc20Transfer);
    });

    it('should skip a policy the Transaction Service could not type, and log it', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policy', getAddress(faker.finance.ethereumAddress()))
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);

      const result = await service.getActivePolicies(request);

      expect(result.items).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unmodelled policy type, skipping the policy',
          policy: confirmation.policy,
        }),
      );
    });

    it('should type a policy from the policyType whatever its address', async () => {
      // CGW holds no address map, so an address it has never seen - which is
      // every address - still types and routes correctly.
      const confirmation = policyConfirmationBuilder()
        .with('policy', getAddress(faker.finance.ethereumAddress()))
        .with('policyType', 'ERC20TransferPolicy')
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);

      const result = await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        groups: [policyGroupBuilder([confirmation])],
        names: new Map(),
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(PolicyType.Erc20Transfer);
    });

    it('should skip a policy the Transaction Service types as one CGW does not model', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policy', getAddress(faker.finance.ethereumAddress()))
        .with('policyType', 'DenyPolicy')
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);

      const result = await service.getActivePolicies(request);

      expect(result.items).toStrictEqual([]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unmodelled policy type, skipping the policy',
          policyType: 'DenyPolicy',
        }),
      );
    });

    it('should route each policy type to its own resolver', async () => {
      const erc20 = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .with('selector', '0xa9059cbb')
        .build();
      const cosigner = policyConfirmationBuilder()
        .with('policyType', 'CoSignerPolicy')
        .with('selector', '0x23b872dd')
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([erc20]),
        policyGroupBuilder([cosigner]),
      ]);

      await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ groups: [policyGroupBuilder([erc20])] }),
      );
      expect(cosignerResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ groups: [policyGroupBuilder([cosigner])] }),
      );
    });

    it('should report the guard and policy contract of the event as enforcement', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('guard', confirmation.guard).build(),
      );

      const result = await service.getActivePolicies(request);

      expect(result.items[0].enforcement).toStrictEqual({
        via: PolicyEnforcementKind.Guard,
        guards: {
          transactionGuard: {
            policyContract: confirmation.policy,
            safePolicyGuard: confirmation.guard,
          },
        },
      });
    });

    it('should mark a policy enabled when its guard is the Safe transaction guard', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder()
          .with('guard', confirmation.guard.toLowerCase() as `0x${string}`)
          .build(),
      );

      const result = await service.getActivePolicies(request);

      expect(result.items[0].enabled).toBe(true);
    });

    it.each([
      ['another guard', getAddress(faker.finance.ethereumAddress())],
      ['no guard', getAddress(NULL_ADDRESS)],
    ])('should mark a configured policy disabled when the Safe has %s', async (_, guard) => {
      const confirmation = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .build();
      mockPoliciesRepository.getPolicyGroups.mockResolvedValue([
        policyGroupBuilder([confirmation]),
      ]);
      mockSafeRepository.getSafe.mockResolvedValue(
        safeBuilder().with('guard', guard).build(),
      );

      const result = await service.getActivePolicies(request);

      expect(result.items[0].enabled).toBe(false);
    });

    it('should pass the space address book names of the chain to the resolvers', async () => {
      const named = getAddress(faker.finance.ethereumAddress());
      const otherChain = getAddress(faker.finance.ethereumAddress());
      mockAddressBookItemsRepository.findAllBySpaceId.mockResolvedValue([
        { address: named, name: 'Payroll', chainIds: [SEPOLIA_CHAIN_ID] },
        { address: otherChain, name: 'Elsewhere', chainIds: ['1'] },
      ] as never);

      await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          names: new Map([[named.toLowerCase(), 'Payroll']]),
        }),
      );
    });

    it('should return an empty list for a Safe without policies', async () => {
      await expect(service.getActivePolicies(request)).resolves.toStrictEqual({
        items: [],
      });
    });

    it('should propagate a Transaction Service failure', async () => {
      mockPoliciesRepository.getPolicyGroups.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(service.getActivePolicies(request)).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('getAvailablePolicies', () => {
    it('should return the catalogue of the chain', async () => {
      const items = [
        {
          type: PolicyType.Cosigner,
          title: 'Cosigner',
          description: 'description',
          available: true,
          isFallback: false,
          enforcement: null,
        },
      ];
      mockPolicyCatalogueService.get.mockReturnValue(items);

      await expect(
        service.getAvailablePolicies(request),
      ).resolves.toStrictEqual({ items });
      expect(mockPolicyCatalogueService.get).toHaveBeenCalledWith(
        SEPOLIA_CHAIN_ID,
      );
    });

    it('should not resolve the policies of the Safe to serve it', async () => {
      // The catalogue depends on nothing per Safe, so counting what is already
      // configured would make a static response cost a fan-out.
      await service.getAvailablePolicies(request);

      expect(mockPoliciesRepository.getPolicyGroups).not.toHaveBeenCalled();
      expect(mockSafeRepository.getSafe).not.toHaveBeenCalled();
      expect(
        mockAddressBookItemsRepository.findAllBySpaceId,
      ).not.toHaveBeenCalled();
    });
  });

  describe('createConfigurationRequest', () => {
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

    it('should store the configurations of an open root', async () => {
      const payload = validPayload();

      const result = await service.createConfigurationRequest({
        ...request,
        payload,
      });

      expect(result).toStrictEqual({ configureRoot: payload.root });
      expect(mockConfigurationRequestsRepository.create).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        safeAddress,
        root: payload.root,
        configurations: payload.configurations,
        spaceId,
        createdBy: userId,
      });
    });

    it('should clear the policy caches of the Safe', async () => {
      const payload = validPayload();

      await service.createConfigurationRequest({ ...request, payload });

      expect(mockPolicyCacheService.clearPolicies).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        safeAddress,
      });
    });

    it('should reject configurations that do not hash to the given root', async () => {
      const payload = validPayload();
      const claimedRoot = hexBuilder(32);

      await expect(
        service.createConfigurationRequest({
          ...request,
          payload: { ...payload, root: claimedRoot },
        }),
      ).rejects.toThrow(
        new UnprocessableEntityException(
          'The configurations do not hash to the given root',
        ),
      );
      expect(mockConfigurationRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should store a root that is not on-chain yet', async () => {
      // The wallet stores the configurations before requesting them on-chain, so
      // an unknown root is the normal case rather than an error.
      const payload = validPayload();
      mockPoliciesRepository.getRootRequests.mockResolvedValue([]);

      await expect(
        service.createConfigurationRequest({ ...request, payload }),
      ).resolves.toStrictEqual({ configureRoot: payload.root });
      expect(mockPoliciesRepository.getRootRequests).not.toHaveBeenCalled();
    });

    it('should accept a root in any hex casing', async () => {
      const payload = validPayload();

      await expect(
        service.createConfigurationRequest({
          ...request,
          payload: {
            ...payload,
            root: payload.root.toUpperCase().replace('0X', '0x') as Hex,
          },
        }),
      ).resolves.toStrictEqual({
        configureRoot: payload.root.toUpperCase().replace('0X', '0x'),
      });
    });

    it('should reject a non member', async () => {
      const payload = validPayload();
      mockMembersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createConfigurationRequest({ ...request, payload }),
      ).rejects.toThrow('User is not a member of this workspace');
      expect(mockConfigurationRequestsRepository.create).not.toHaveBeenCalled();
    });

    it('should reject a Safe that is not in the space', async () => {
      const payload = validPayload();
      mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([]);

      await expect(
        service.createConfigurationRequest({ ...request, payload }),
      ).rejects.toThrow(new NotFoundException('Safe not found in this space'));
    });

    it('should reject an unauthenticated caller', async () => {
      const payload = validPayload();

      await expect(
        service.createConfigurationRequest({
          ...request,
          authPayload: new AuthPayload(undefined),
          payload,
        }),
      ).rejects.toThrow('Not authenticated');
    });

    it('should propagate a storage failure', async () => {
      const payload = validPayload();
      mockConfigurationRequestsRepository.create.mockRejectedValue(
        new BadRequestException('This Safe only allows a maximum of 20'),
      );

      await expect(
        service.createConfigurationRequest({ ...request, payload }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPolicyCacheService.clearPolicies).not.toHaveBeenCalled();
    });
  });

  describe('getPendingPolicies', () => {
    // `isReady` is derived from the wall clock, so it is pinned here.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** A stored row for `root`, holding `configurations`. */
    function storedRow(
      root: Hex,
      configurations: Array<PolicyConfiguration>,
      overrides?: { spaceId?: number; createdAt?: Date },
    ): PolicyConfigurationRequest {
      return {
        chainId: SEPOLIA_CHAIN_ID,
        safeAddress,
        root,
        configurations,
        spaceId: overrides?.spaceId ?? spaceId,
        createdAt: overrides?.createdAt ?? new Date('2026-07-27T09:00:00Z'),
      } as PolicyConfigurationRequest;
    }

    it('should map a root request to a pending policy', async () => {
      const requestedAt = new Date('2026-07-27T10:00:00Z');
      const readyAt = new Date('2026-07-27T11:00:00Z');
      const rootRequest = policyRootRequestBuilder()
        .with('timestamp', requestedAt)
        .with('validFrom', readyAt)
        .build();
      mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
      vi.setSystemTime(new Date('2026-07-27T10:30:00Z'));

      const result = await service.getPendingPolicies(request);

      expect(result).toStrictEqual({
        items: [
          {
            configureRoot: rootRequest.root,
            isRootConfigured: true,
            requestedAt: requestedAt.getTime() / 1000,
            readyAt: readyAt.getTime() / 1000,
            isReady: false,
            policies: null,
          },
        ],
      });
    });

    it('should drop an invalidated request', async () => {
      const invalidated = policyRootRequestBuilder()
        .with('status', PolicyRootRequestStatus.Invalidated)
        .build();
      mockPoliciesRepository.getRootRequests.mockResolvedValue([invalidated]);

      await expect(service.getPendingPolicies(request)).resolves.toStrictEqual({
        items: [],
      });
    });

    it('should mark a request ready once the delay has elapsed', async () => {
      const rootRequest = policyRootRequestBuilder()
        .with('validFrom', new Date('2026-07-27T11:00:00Z'))
        .build();
      mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
      vi.setSystemTime(new Date('2026-07-27T11:00:00Z'));

      const result = await service.getPendingPolicies(request);

      expect(result.items[0].isReady).toBe(true);
    });

    it('should report the stored configurations of a root', async () => {
      const rootRequest = policyRootRequestBuilder().build();
      const configurations = [
        policyConfigurationBuilder().build(),
        policyConfigurationBuilder().build(),
      ];
      mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
      mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
        storedRow(rootRequest.root, configurations),
      ]);

      const result = await service.getPendingPolicies(request);

      // one entry per configuration, in the order they were submitted
      expect(result.items[0].policies).toStrictEqual(
        configurations.map(toPolicyInfo),
      );
      expect(
        mockConfigurationRequestsRepository.findBySafe,
      ).toHaveBeenCalledWith({ chainId: SEPOLIA_CHAIN_ID, safeAddress });
    });

    it('should report null policies for a root without a stored row', async () => {
      // Null rather than an empty list, so the wallet can tell "requested,
      // contents unknown to CGW" apart from a request CGW can explain.
      const rootRequest = policyRootRequestBuilder().build();
      mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
      mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([]);

      const result = await service.getPendingPolicies(request);

      expect(result.items[0].policies).toBeNull();
    });

    it('should resolve each root independently', async () => {
      // Timestamps pinned: the items come back newest first.
      const stored = policyRootRequestBuilder()
        .with('timestamp', new Date('2026-07-27T11:00:00Z'))
        .build();
      const unknown = policyRootRequestBuilder()
        .with('timestamp', new Date('2026-07-27T10:00:00Z'))
        .build();
      const configurations = [policyConfigurationBuilder().build()];
      mockPoliciesRepository.getRootRequests.mockResolvedValue([
        stored,
        unknown,
      ]);
      mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
        storedRow(stored.root, configurations),
      ]);

      const result = await service.getPendingPolicies(request);

      expect(result.items[0].policies).toStrictEqual(
        configurations.map(toPolicyInfo),
      );
      expect(result.items[1].policies).toBeNull();
    });

    it('should match a stored root in any hex casing', async () => {
      const rootRequest = policyRootRequestBuilder().build();
      const configurations = [policyConfigurationBuilder().build()];
      mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
      mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
        storedRow(
          rootRequest.root.toUpperCase().replace('0X', '0x') as Hex,
          configurations,
        ),
      ]);

      const result = await service.getPendingPolicies(request);

      expect(result.items[0].policies).toHaveLength(1);
      // the row explains the request, so it is not also reported as unrequested
      expect(result.items).toHaveLength(1);
    });

    it('should read the stored rows in a single query', async () => {
      mockPoliciesRepository.getRootRequests.mockResolvedValue([
        policyRootRequestBuilder().build(),
        policyRootRequestBuilder().build(),
        policyRootRequestBuilder().build(),
      ]);

      await service.getPendingPolicies(request);

      expect(
        mockConfigurationRequestsRepository.findBySafe,
      ).toHaveBeenCalledTimes(1);
    });

    describe('configurations without an on-chain request', () => {
      it('should report a stored row no root request carries', async () => {
        // A space admin can store the configurations without being able to sign
        // for the Safe, so the change would otherwise be invisible to the owners
        // who have to execute `requestConfiguration`.
        const createdAt = new Date('2026-07-27T09:00:00Z');
        const configurations = [policyConfigurationBuilder().build()];
        const row = storedRow(hexBuilder(32), configurations, { createdAt });
        mockPoliciesRepository.getRootRequests.mockResolvedValue([]);
        mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([row]);

        const result = await service.getPendingPolicies(request);

        expect(result).toStrictEqual({
          items: [
            {
              configureRoot: row.root,
              isRootConfigured: false,
              requestedAt: createdAt.getTime() / 1000,
              readyAt: null,
              isReady: false,
              policies: configurations.map(toPolicyInfo),
            },
          ],
        });
      });

      it('should not report a row whose root was requested', async () => {
        const rootRequest = policyRootRequestBuilder().build();
        mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
        mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
          storedRow(rootRequest.root, [policyConfigurationBuilder().build()]),
        ]);

        const result = await service.getPendingPolicies(request);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].isRootConfigured).toBe(true);
      });

      it('should not resurrect a row whose root was invalidated', async () => {
        // The request was cancelled on-chain, which is not the same as never
        // having been made - it must not reappear as awaiting execution.
        const invalidated = policyRootRequestBuilder()
          .with('status', PolicyRootRequestStatus.Invalidated)
          .build();
        mockPoliciesRepository.getRootRequests.mockResolvedValue([invalidated]);
        mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
          storedRow(invalidated.root, [policyConfigurationBuilder().build()]),
        ]);

        await expect(
          service.getPendingPolicies(request),
        ).resolves.toStrictEqual({ items: [] });
      });

      it('should match a requested root in any hex casing', async () => {
        const rootRequest = policyRootRequestBuilder().build();
        mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
        mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
          storedRow(rootRequest.root.toUpperCase().replace('0X', '0x') as Hex, [
            policyConfigurationBuilder().build(),
          ]),
        ]);

        const result = await service.getPendingPolicies(request);

        expect(result.items).toHaveLength(1);
      });

      it('should not report a row stored through another space', async () => {
        // Nothing on-chain describes it, so it is a draft of the space it was
        // created in rather than public state of the Safe.
        mockPoliciesRepository.getRootRequests.mockResolvedValue([]);
        mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
          storedRow(hexBuilder(32), [policyConfigurationBuilder().build()], {
            spaceId: spaceId + 1,
          }),
        ]);

        await expect(
          service.getPendingPolicies(request),
        ).resolves.toStrictEqual({ items: [] });
      });

      it('should sort the items newest first, whether requested or not', async () => {
        const rootRequest = policyRootRequestBuilder()
          .with('timestamp', new Date('2026-07-27T10:00:00Z'))
          .build();
        const older = storedRow(
          hexBuilder(32),
          [policyConfigurationBuilder().build()],
          { createdAt: new Date('2026-07-27T09:00:00Z') },
        );
        const newer = storedRow(
          hexBuilder(32),
          [policyConfigurationBuilder().build()],
          { createdAt: new Date('2026-07-27T11:00:00Z') },
        );
        mockPoliciesRepository.getRootRequests.mockResolvedValue([rootRequest]);
        mockConfigurationRequestsRepository.findBySafe.mockResolvedValue([
          older,
          newer,
        ]);

        const result = await service.getPendingPolicies(request);

        expect(result.items.map((item) => item.configureRoot)).toStrictEqual([
          newer.root,
          rootRequest.root,
          older.root,
        ]);
      });
    });

    it('should return an empty list without pending requests', async () => {
      await expect(service.getPendingPolicies(request)).resolves.toStrictEqual({
        items: [],
      });
    });
  });
});
