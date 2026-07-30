// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { NotFoundException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyRootRequestBuilder } from '@/modules/policies/domain/entities/__tests__/policy-root-request.builder';
import type { Erc20TransferPolicyData } from '@/modules/policies/domain/entities/active-policy.entity';
import type { PolicyConfirmation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import type { IPoliciesRepository } from '@/modules/policies/domain/policies.repository.interface';
import type { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
import type {
  PolicyResolver,
  PolicyResolverContext,
  ResolvedPolicy,
} from '@/modules/policies/domain/resolvers/policy-resolver.interface';
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
  getActiveConfirmations: vi.fn(),
  getOpenRootRequests: vi.fn(),
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

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

/**
 * Resolver double that echoes the confirmations it was given, so the service's
 * grouping and Safe-level enrichment can be asserted in isolation.
 */
function resolverStub(type: PolicyType): MockedObject<PolicyResolver> {
  return {
    type,
    resolve: vi.fn(async ({ confirmations }: PolicyResolverContext) =>
      confirmations.map(
        (confirmation: PolicyConfirmation): ResolvedPolicy => ({
          id: `0x${type.length.toString(16).padStart(2, '0')}${confirmation.logIndex}`,
          type,
          data: { allowlist: [] } as Erc20TransferPolicyData,
          sources: [confirmation],
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
      mockPolicyCatalogueService,
      [erc20Resolver, cosignerResolver],
      mockLoggingService,
    );

    // authorised by default: active member, Safe in the space
    mockMembersRepository.findOne.mockResolvedValue({ id: 1 } as never);
    mockSpaceSafesRepository.findBySpaceId.mockResolvedValue([
      { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
    ] as never);
    mockAddressBookItemsRepository.findAllBySpaceId.mockResolvedValue([]);
    mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([]);
    mockPoliciesRepository.getOpenRootRequests.mockResolvedValue([]);
    mockSafeRepository.getSafe.mockResolvedValue(safeBuilder().build());
    mockPolicyCatalogueService.get.mockResolvedValue([]);
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
    it('should route confirmations to the resolver of their policy type', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .build();
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
      ]);

      const result = await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        confirmations: [confirmation],
        names: new Map(),
      });
      expect(cosignerResolver.resolve).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        confirmations: [],
        names: new Map(),
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(PolicyType.Erc20Transfer);
    });

    it('should skip a policy the Transaction Service could not type, and log it', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policy', getAddress(faker.finance.ethereumAddress()))
        .build();
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
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
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
      ]);

      const result = await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        confirmations: [confirmation],
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
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
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
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        erc20,
        cosigner,
      ]);

      await service.getActivePolicies(request);

      expect(erc20Resolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ confirmations: [erc20] }),
      );
      expect(cosignerResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({ confirmations: [cosigner] }),
      );
    });

    it('should report the guard and policy contract of the event as enforcement', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .build();
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
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
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
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
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        confirmation,
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
      mockPoliciesRepository.getActiveConfirmations.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(service.getActivePolicies(request)).rejects.toThrow(
        'Service unavailable',
      );
    });
  });

  describe('getAvailablePolicies', () => {
    it('should count the active policies per type', async () => {
      const first = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .with('logIndex', 1)
        .build();
      const second = policyConfirmationBuilder()
        .with('policyType', ERC20_TRANSFER_POLICY_TYPE)
        .with('logIndex', 2)
        .build();
      mockPoliciesRepository.getActiveConfirmations.mockResolvedValue([
        first,
        second,
      ]);

      await service.getAvailablePolicies(request);

      expect(mockPolicyCatalogueService.get).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        configuredCounts: { [PolicyType.Erc20Transfer]: 2 },
      });
    });

    it('should count nothing for a Safe without policies', async () => {
      await service.getAvailablePolicies(request);

      expect(mockPolicyCatalogueService.get).toHaveBeenCalledWith({
        chainId: SEPOLIA_CHAIN_ID,
        configuredCounts: {},
      });
    });

    it('should return the catalogue', async () => {
      const items = [
        {
          type: PolicyType.Cosigner,
          title: 'Cosigner',
          description: 'description',
          available: false,
          configuredCount: 0,
          enforcement: null,
        },
      ];
      mockPolicyCatalogueService.get.mockResolvedValue(items);

      await expect(
        service.getAvailablePolicies(request),
      ).resolves.toStrictEqual({ items });
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

    it('should map a root request to a pending policy', async () => {
      const requestedAt = new Date('2026-07-27T10:00:00Z');
      const readyAt = new Date('2026-07-27T11:00:00Z');
      const rootRequest = policyRootRequestBuilder()
        .with('timestamp', requestedAt)
        .with('validFrom', readyAt)
        .build();
      mockPoliciesRepository.getOpenRootRequests.mockResolvedValue([
        rootRequest,
      ]);
      vi.setSystemTime(new Date('2026-07-27T10:30:00Z'));

      const result = await service.getPendingPolicies(request);

      expect(result).toStrictEqual({
        items: [
          {
            configureRoot: rootRequest.root,
            requestedAt: requestedAt.getTime() / 1000,
            readyAt: readyAt.getTime() / 1000,
            isReady: false,
            policy: null,
          },
        ],
      });
    });

    it('should mark a request ready once the delay has elapsed', async () => {
      const rootRequest = policyRootRequestBuilder()
        .with('validFrom', new Date('2026-07-27T11:00:00Z'))
        .build();
      mockPoliciesRepository.getOpenRootRequests.mockResolvedValue([
        rootRequest,
      ]);
      vi.setSystemTime(new Date('2026-07-27T11:00:00Z'));

      const result = await service.getPendingPolicies(request);

      expect(result.items[0].isReady).toBe(true);
    });

    it('should return an empty list without pending requests', async () => {
      await expect(service.getPendingPolicies(request)).resolves.toStrictEqual({
        items: [],
      });
    });
  });
});
