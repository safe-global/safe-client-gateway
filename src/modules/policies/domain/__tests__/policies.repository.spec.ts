// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  policyConfirmationBuilder,
  rawPolicyConfirmation,
} from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyGroupBuilder } from '@/modules/policies/domain/entities/__tests__/policy-group.builder';
import { policyRootRequestBuilder } from '@/modules/policies/domain/entities/__tests__/policy-root-request.builder';
import { PolicyRootRequestStatus } from '@/modules/policies/domain/entities/policy-root-request.entity';
import { PoliciesRepository } from '@/modules/policies/domain/policies.repository';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { rawify } from '@/validation/entities/raw.entity';

const mockTransactionApi = {
  getPolicyConfirmations: vi.fn(),
  getPolicyRootRequests: vi.fn(),
} as MockedObject<ITransactionApi>;

const mockTransactionApiManager = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('PoliciesRepository', () => {
  let repository: PoliciesRepository;
  const chainId = faker.string.numeric({ length: 3 });
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    repository = new PoliciesRepository(
      mockTransactionApiManager,
      mockLoggingService,
    );
  });

  describe('getPolicyGroups', () => {
    it('should return one validated group per access', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('safe', safeAddress)
        .build();
      mockTransactionApi.getPolicyConfirmations.mockResolvedValue(
        rawify(
          pageBuilder()
            .with('results', [rawPolicyConfirmation(confirmation)])
            .with('next', null)
            .build(),
        ),
      );

      const result = await repository.getPolicyGroups({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([policyGroupBuilder([confirmation])]);
      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
      expect(mockTransactionApi.getPolicyConfirmations).toHaveBeenCalledWith({
        safeAddress,
        limit: 100,
        offset: 0,
      });
    });

    it('should exclude removals', async () => {
      const target = getAddress(faker.finance.ethereumAddress());
      const added = policyConfirmationBuilder()
        .with('target', target)
        .with('blockNumber', 1)
        .build();
      const removed = policyConfirmationBuilder()
        .with('guard', added.guard)
        .with('target', target)
        .with('selector', added.selector)
        .with('operation', added.operation)
        .with('policy', NULL_ADDRESS)
        .with('removed', true)
        .with('blockNumber', 2)
        .build();
      mockTransactionApi.getPolicyConfirmations.mockResolvedValue(
        rawify(
          pageBuilder()
            .with('results', [
              rawPolicyConfirmation(removed),
              rawPolicyConfirmation(added),
            ])
            .with('next', null)
            .build(),
        ),
      );

      const result = await repository.getPolicyGroups({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([]);
    });

    it('should group every configure call of an access, oldest first', async () => {
      // Regression: collapsing an access to its newest event dropped the earlier
      // configure calls, so an allowlist built up over three transactions was
      // reported with only the recipient of the last one.
      const target = getAddress(faker.finance.ethereumAddress());
      const policy = getAddress(faker.finance.ethereumAddress());
      const history = [465, 469, 473].map((blockNumber) =>
        policyConfirmationBuilder()
          .with('target', target)
          .with('policy', policy)
          .with('blockNumber', blockNumber)
          .with('logIndex', 1)
          .build(),
      );
      mockTransactionApi.getPolicyConfirmations.mockResolvedValue(
        rawify(
          pageBuilder()
            // newest first, as the Transaction Service returns them
            .with('results', [...history].reverse().map(rawPolicyConfirmation))
            .with('next', null)
            .build(),
        ),
      );

      const result = await repository.getPolicyGroups({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([
        policyGroupBuilder([history[0], history[1], history[2]]),
      ]);
    });

    it('should drop invalid events instead of failing', async () => {
      const confirmation = policyConfirmationBuilder().build();
      mockTransactionApi.getPolicyConfirmations.mockResolvedValue(
        rawify(
          pageBuilder()
            .with('results', [
              rawPolicyConfirmation(confirmation),
              { safe: 'not-an-address' },
            ])
            .with('next', null)
            .build(),
        ),
      );

      const result = await repository.getPolicyGroups({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([policyGroupBuilder([confirmation])]);
    });

    it('should follow pagination until the last page', async () => {
      const first = policyConfirmationBuilder().build();
      const second = policyConfirmationBuilder().build();
      mockTransactionApi.getPolicyConfirmations
        .mockResolvedValueOnce(
          rawify(
            pageBuilder()
              .with('results', [rawPolicyConfirmation(first)])
              .with('next', faker.internet.url())
              .build(),
          ),
        )
        .mockResolvedValueOnce(
          rawify(
            pageBuilder()
              .with('results', [rawPolicyConfirmation(second)])
              .with('next', null)
              .build(),
          ),
        );

      const result = await repository.getPolicyGroups({
        chainId,
        safeAddress,
      });

      expect(result).toHaveLength(2);
      expect(mockTransactionApi.getPolicyConfirmations).toHaveBeenCalledTimes(
        2,
      );
      expect(
        mockTransactionApi.getPolicyConfirmations,
      ).toHaveBeenLastCalledWith({ safeAddress, limit: 100, offset: 100 });
    });

    it('should stop at the page limit and log the truncation', async () => {
      mockTransactionApi.getPolicyConfirmations.mockResolvedValue(
        rawify(
          pageBuilder()
            .with('results', [
              rawPolicyConfirmation(policyConfirmationBuilder().build()),
            ])
            .with('next', faker.internet.url())
            .build(),
        ),
      );

      await repository.getPolicyGroups({ chainId, safeAddress });

      expect(mockTransactionApi.getPolicyConfirmations).toHaveBeenCalledTimes(
        10,
      );
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Reached the policy page limit, policy-confirmations may be incomplete',
          chainId,
          safeAddress,
        }),
      );
    });

    it('should return an empty list for a Safe without policies', async () => {
      mockTransactionApi.getPolicyConfirmations.mockResolvedValue(
        rawify(pageBuilder().with('results', []).with('next', null).build()),
      );

      await expect(
        repository.getPolicyGroups({ chainId, safeAddress }),
      ).resolves.toStrictEqual([]);
    });

    it('should propagate a Transaction Service error', async () => {
      mockTransactionApi.getPolicyConfirmations.mockRejectedValue(
        new Error('Service unavailable'),
      );

      await expect(
        repository.getPolicyGroups({ chainId, safeAddress }),
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('getRootRequests', () => {
    it('should keep invalidated requests, which the caller filters', async () => {
      // A cancelled root is history, but it is still a root that *was*
      // requested - which is what tells it apart from one that never was.
      const pending = policyRootRequestBuilder()
        .with('status', PolicyRootRequestStatus.Pending)
        .with('timestamp', new Date('2026-02-01T00:00:00Z'))
        .build();
      const invalidated = policyRootRequestBuilder()
        .with('status', PolicyRootRequestStatus.Invalidated)
        .with('invalidatedAt', faker.date.recent())
        .with('timestamp', new Date('2026-01-01T00:00:00Z'))
        .build();
      mockTransactionApi.getPolicyRootRequests.mockResolvedValue(
        rawify(
          pageBuilder()
            .with('results', [pending, invalidated])
            .with('next', null)
            .build(),
        ),
      );

      const result = await repository.getRootRequests({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([pending, invalidated]);
    });

    it.each([
      PolicyRootRequestStatus.Pending,
      PolicyRootRequestStatus.Ready,
    ])('should keep a %s request', async (status) => {
      const request = policyRootRequestBuilder().with('status', status).build();
      mockTransactionApi.getPolicyRootRequests.mockResolvedValue(
        rawify(
          pageBuilder().with('results', [request]).with('next', null).build(),
        ),
      );

      const result = await repository.getRootRequests({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([request]);
    });

    it('should return the newest request first', async () => {
      const older = policyRootRequestBuilder()
        .with('timestamp', new Date('2026-01-01T00:00:00Z'))
        .build();
      const newer = policyRootRequestBuilder()
        .with('timestamp', new Date('2026-02-01T00:00:00Z'))
        .build();
      mockTransactionApi.getPolicyRootRequests.mockResolvedValue(
        rawify(
          pageBuilder()
            .with('results', [older, newer])
            .with('next', null)
            .build(),
        ),
      );

      const result = await repository.getRootRequests({
        chainId,
        safeAddress,
      });

      expect(result).toStrictEqual([newer, older]);
    });

    it('should follow pagination', async () => {
      mockTransactionApi.getPolicyRootRequests
        .mockResolvedValueOnce(
          rawify(
            pageBuilder()
              .with('results', [policyRootRequestBuilder().build()])
              .with('next', faker.internet.url())
              .build(),
          ),
        )
        .mockResolvedValueOnce(
          rawify(
            pageBuilder()
              .with('results', [policyRootRequestBuilder().build()])
              .with('next', null)
              .build(),
          ),
        );

      const result = await repository.getRootRequests({
        chainId,
        safeAddress,
      });

      expect(result).toHaveLength(2);
    });
  });
});
