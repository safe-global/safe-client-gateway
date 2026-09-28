// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import type { ILoggingService } from '@/logging/logging.interface';
import type { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import {
  rawIndexerMetaBuilder,
  rawPolicyIndexerResponse,
} from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import {
  rawIndexerSafeAllowanceBuilder,
  rawIndexerSafeDelegateBuilder,
} from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import { PolicyIndexerRepository } from '@/modules/policies/domain/policy-indexer.repository';
import { rawify } from '@/validation/entities/raw.entity';

const mockPolicyIndexerApi = {
  getState: vi.fn(),
  clearState: vi.fn(),
} as MockedObject<PolicyIndexerApi>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA = '11155111';

describe('PolicyIndexerRepository', () => {
  let target: PolicyIndexerRepository;
  const safe = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    vi.resetAllMocks();
    mockPolicyIndexerApi.getState.mockResolvedValue(
      rawify(rawPolicyIndexerResponse()),
    );
    target = new PolicyIndexerRepository(
      mockPolicyIndexerApi,
      mockLoggingService,
    );
  });

  describe('get policies request', () => {
    it('should read the state of every requested safe in one call', async () => {
      await target.getState({
        safes: [
          { chainId: SEPOLIA, address: safe },
          { chainId: '137', address: safe },
        ],
      });

      expect(mockPolicyIndexerApi.getState).toHaveBeenCalledTimes(1);
    });

    it('should checksum the addresses it asks for', async () => {
      // The indexer stores addresses checksummed and a lower-cased address in a
      // filter matches nothing *and returns no error*.
      await target.getState({
        safes: [
          { chainId: SEPOLIA, address: safe.toLowerCase() as `0x${string}` },
        ],
      });

      expect(mockPolicyIndexerApi.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });
    });

    it('should ask for a repeated pair once', async () => {
      await target.getState({
        safes: [
          { chainId: SEPOLIA, address: safe },
          { chainId: SEPOLIA, address: safe.toLowerCase() as `0x${string}` },
        ],
      });

      expect(mockPolicyIndexerApi.getState).toHaveBeenCalledWith({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });
    });

    it('should return empty state without a request when no safe is given', async () => {
      await expect(target.getState({ safes: [] })).resolves.toStrictEqual({
        meta: [],
        allowances: [],
        delegates: [],
      });
      expect(mockPolicyIndexerApi.getState).not.toHaveBeenCalled();
    });

    it('should propagate a failed read', async () => {
      mockPolicyIndexerApi.getState.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(
        target.getState({ safes: [{ chainId: SEPOLIA, address: safe }] }),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('invalidation', () => {
    it('should forget the state of one safe', async () => {
      await target.clearState({ chainId: SEPOLIA, safeAddress: safe });

      expect(mockPolicyIndexerApi.clearState).toHaveBeenCalledWith({
        chainId: SEPOLIA,
        safeAddress: safe,
      });
    });
  });

  describe('conversions', () => {
    it('should convert chainId from a number to a string', async () => {
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('chainId', 137)
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerResponse({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: '137', address: safe }],
      });

      expect(result.allowances[0].chainId).toBe('137');
    });

    it('should keep base units as strings', async () => {
      // 10^24 does not survive a round trip through a number.
      const amount = (10n ** 24n).toString();
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('amount', amount)
        .with('spent', '0')
        .with('remaining', amount)
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerResponse({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].amount).toBe(amount);
      expect(result.allowances[0].remaining).toBe(amount);
    });

    it('should convert minutes and seconds to numbers', async () => {
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('resetTimeMinutes', '1440')
        .with('lastResetMin', '29793086')
        .with('updatedAt', '1787585160')
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerResponse({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0]).toMatchObject({
        resetTimeMinutes: 1440,
        lastResetMin: 29793086,
        updatedAt: 1787585160,
      });
    });

    it('should drop a row whose integer column exceeds the safe range', async () => {
      // Truncating it would produce a plausible, wrong reset boundary.
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('lastResetMin', (2n ** 64n).toString())
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerResponse({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances).toStrictEqual([]);
    });
  });

  describe('leniency', () => {
    it('should keep the readable rows of a field and drop the rest', async () => {
      const readable = rawIndexerSafeDelegateBuilder().build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerResponse({
            SafeDelegate: [readable, { safe: 'not-an-address' }],
          }),
        ),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.delegates).toHaveLength(1);
      expect(result.delegates[0].delegate).toBe(readable.delegate);
    });

    it('should log what it dropped, and from which field', async () => {
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerResponse({ SafeDelegate: [{ nope: true }] })),
      );

      await target.getState({ safes: [{ chainId: SEPOLIA, address: safe }] });

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Dropped unreadable policy indexer rows',
          field: 'SafeDelegate',
          dropped: 1,
          of: 1,
        }),
      );
    });

    it('should read a reset phase it does not know as UNKNOWN', async () => {
      // Pessimistic: an unverified boundary is not reported as exact.
      // A phase no release of CGW knows, so it cannot come from the builder.
      const allowance = {
        ...rawIndexerSafeAllowanceBuilder().build(),
        resetPhase: 'SOMETHING_NEW',
      };
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerResponse({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].resetPhase).toBe('UNKNOWN');
    });

    it('should fail the read when the envelope itself is unreadable', async () => {
      // A missing root field is a contract change, not a row CGW can skip.
      mockPolicyIndexerApi.getState.mockResolvedValue(rawify({ _meta: [] }));

      await expect(
        target.getState({ safes: [{ chainId: SEPOLIA, address: safe }] }),
      ).rejects.toThrow(ZodError);
    });
  });

  describe('the delegate registration', () => {
    /** A raw allowance and the raw delegate row that registers its spender. */
    function pair(active: boolean): {
      allowance: ReturnType<typeof rawIndexerSafeAllowanceBuilder>;
      delegate: ReturnType<typeof rawIndexerSafeDelegateBuilder>;
    } {
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('chainId', Number(SEPOLIA))
        .with('safe', safe);

      return {
        allowance,
        delegate: rawIndexerSafeDelegateBuilder()
          .with('chainId', Number(SEPOLIA))
          .with('safe', safe)
          .with('module', allowance.build().module)
          .with('delegate', allowance.build().delegate)
          .with('active', active),
      };
    }

    it('should fold an active registration onto the allowance', async () => {
      // The indexer stopped mirroring it onto the allowance row, so the flag is
      // CGW's own join of the two root fields.
      const { allowance, delegate } = pair(true);
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerResponse({
            SafeAllowance: [allowance.build()],
            SafeDelegate: [delegate.build()],
          }),
        ),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].isDelegateActive).toBe(true);
    });

    it('should fold a deregistered delegate onto the allowance', async () => {
      const { allowance, delegate } = pair(false);
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerResponse({
            SafeAllowance: [allowance.build()],
            SafeDelegate: [delegate.build()],
          }),
        ),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].isDelegateActive).toBe(false);
    });

    it('should read an allowance with no registration at all as inactive', async () => {
      // RemoveDelegate unlinks the node and leaves the limit behind, so a
      // missing row is a removed delegate rather than an unknown one.
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerResponse({
            SafeAllowance: [rawIndexerSafeAllowanceBuilder().build()],
          }),
        ),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].isDelegateActive).toBe(false);
    });

    it('should not borrow the registration of another module deployment', async () => {
      // Two deployments hold independent state, so a delegate registered on one
      // says nothing about the same address on the other.
      const { allowance, delegate } = pair(true);
      const elsewhere = delegate
        .with('module', getAddress(faker.finance.ethereumAddress()))
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerResponse({
            SafeAllowance: [allowance.build()],
            SafeDelegate: [elsewhere],
          }),
        ),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].isDelegateActive).toBe(false);
    });
  });

  describe('fields', () => {
    it('should report the indexing progress of every chain', async () => {
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerResponse({
            _meta: [
              rawIndexerMetaBuilder().with('chainId', 11155111).build(),
              rawIndexerMetaBuilder()
                .with('chainId', 137)
                .with('progressBlock', 10)
                .with('sourceBlock', 42)
                .build(),
            ],
          }),
        ),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.meta.map((meta) => meta.chainId)).toStrictEqual([
        '11155111',
        '137',
      ]);
      expect(result.meta[1]).toMatchObject({
        progressBlock: 10,
        sourceBlock: 42,
      });
    });
  });
});
