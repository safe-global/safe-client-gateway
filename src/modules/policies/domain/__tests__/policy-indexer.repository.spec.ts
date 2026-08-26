// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import type { ILoggingService } from '@/logging/logging.interface';
import type { PolicyIndexerApi } from '@/modules/policies/datasources/policy-indexer-api.service';
import {
  rawIndexerMetaBuilder,
  rawPolicyIndexerState,
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
} as unknown as MockedObject<PolicyIndexerApi>;

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
      rawify(rawPolicyIndexerState()),
    );
    target = new PolicyIndexerRepository(
      mockPolicyIndexerApi,
      mockLoggingService,
    );
  });

  describe('the request', () => {
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
        policies: [],
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
        rawify(rawPolicyIndexerState({ SafeAllowance: [allowance] })),
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
        rawify(rawPolicyIndexerState({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].amount).toBe(amount);
      expect(result.allowances[0].remaining).toBe(amount);
    });

    it('should convert seconds and minutes to numbers', async () => {
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('resetTimeMinutes', '1440')
        .with('lastResetAt', '1787585160')
        .with('nextResetAt', '1787671560')
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerState({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0]).toMatchObject({
        resetTimeMinutes: 1440,
        lastResetAt: 1787585160,
        nextResetAt: 1787671560,
      });
    });

    it('should drop a row whose integer column exceeds the safe range', async () => {
      // Truncating it would produce a plausible, wrong reset boundary.
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('lastResetAt', (2n ** 64n).toString())
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerState({ SafeAllowance: [allowance] })),
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
          rawPolicyIndexerState({
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
        rawify(rawPolicyIndexerState({ SafeDelegate: [{ nope: true }] })),
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

    it('should read a reset phase it does not know as ASSUMED', async () => {
      // Pessimistic: an unverified boundary is not reported as exact.
      const allowance = rawIndexerSafeAllowanceBuilder()
        .with('resetPhase', 'SOMETHING_NEW')
        .build();
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(rawPolicyIndexerState({ SafeAllowance: [allowance] })),
      );

      const result = await target.getState({
        safes: [{ chainId: SEPOLIA, address: safe }],
      });

      expect(result.allowances[0].resetPhase).toBe('ASSUMED');
    });

    it('should fail the read when the envelope itself is unreadable', async () => {
      // A missing root field is a contract change, not a row CGW can skip.
      mockPolicyIndexerApi.getState.mockResolvedValue(rawify({ _meta: [] }));

      await expect(
        target.getState({ safes: [{ chainId: SEPOLIA, address: safe }] }),
      ).rejects.toThrow(ZodError);
    });
  });

  describe('fields', () => {
    it('should report the indexing progress of every chain', async () => {
      mockPolicyIndexerApi.getState.mockResolvedValue(
        rawify(
          rawPolicyIndexerState({
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
