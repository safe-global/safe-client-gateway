// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { ICloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import type { CloudCosignerPolicyService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-policy.service';
import type { CloudCosignerReviewService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-review.service';
import {
  cloudCosignerPolicyBuilder,
  safeCloudCosignerPolicyBuilder,
} from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import { cloudCosignerReviewBuilder } from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-review.builder';
import { CloudCosignerService } from '@/modules/cloud-cosigner/routes/cloud-cosigner.service';

const mockPolicyService = {
  getCosignerAddress: vi.fn(),
  getDefaultPolicy: vi.fn(),
  getSafeStatus: vi.fn(),
  updatePolicy: vi.fn(),
} as unknown as MockedObject<CloudCosignerPolicyService>;

const mockRepository = {
  getReview: vi.fn(),
} as unknown as MockedObject<ICloudCosignerRepository>;

const mockReviewService = {
  enqueueEvent: vi.fn(),
} as unknown as MockedObject<CloudCosignerReviewService>;

describe('CloudCosignerService (routes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const service = new CloudCosignerService(
    mockPolicyService,
    mockRepository,
    mockReviewService,
  );

  it('should return the cosigner address and default policy', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const defaultPolicy = cloudCosignerPolicyBuilder().build();
    mockPolicyService.getCosignerAddress.mockResolvedValue(address);
    mockPolicyService.getDefaultPolicy.mockReturnValue(defaultPolicy);

    await expect(service.getInfo()).resolves.toStrictEqual({
      address,
      defaultPolicy,
    });
  });

  it('should map a stored policy to the response shape', async () => {
    const stored = safeCloudCosignerPolicyBuilder().build();
    mockPolicyService.updatePolicy.mockResolvedValue(stored);
    const body = {
      policy: cloudCosignerPolicyBuilder().build(),
      signer: getAddress(faker.finance.ethereumAddress()),
      signature: faker.string.hexadecimal({ length: 130 }) as Hex,
      issuedAt: new Date(),
    };

    await expect(
      service.updatePolicy({
        chainId: stored.chainId,
        safeAddress: stored.safeAddress,
        body,
      }),
    ).resolves.toStrictEqual({
      valueThresholdUsd: stored.valueThresholdUsd,
      reviewUnknownContracts: stored.reviewUnknownContracts,
      instructions: stored.instructions,
    });
    expect(mockPolicyService.updatePolicy).toHaveBeenCalledWith({
      chainId: stored.chainId,
      safeAddress: stored.safeAddress,
      ...body,
    });
  });

  it('should expose a review without its signature or row metadata', async () => {
    const review = cloudCosignerReviewBuilder().build();
    mockRepository.getReview.mockResolvedValue(review);

    await expect(
      service.getReview({
        chainId: review.chainId,
        safeTxHash: review.safeTxHash,
      }),
    ).resolves.toStrictEqual({
      chainId: review.chainId,
      safeAddress: review.safeAddress,
      safeTxHash: review.safeTxHash,
      status: review.status,
      mode: review.mode,
      triggeredRules: review.triggeredRules,
      summary: review.summary,
      riskFlags: review.riskFlags,
      model: review.model,
      reviewedAt: review.updatedAt.toISOString(),
    });
  });

  describe('onEvent', () => {
    it('should queue a pending multisig transaction event', async () => {
      const event = {
        type: 'PENDING_MULTISIG_TRANSACTION',
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
      };
      mockReviewService.enqueueEvent.mockResolvedValue(undefined);

      await service.onEvent(event);

      expect(mockReviewService.enqueueEvent).toHaveBeenCalledExactlyOnceWith(
        event,
      );
    });

    it('should ignore every other event type', async () => {
      await service.onEvent({
        type: 'NEW_CONFIRMATION',
        chainId: faker.string.numeric(),
        address: getAddress(faker.finance.ethereumAddress()),
        safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
      });

      expect(mockReviewService.enqueueEvent).not.toHaveBeenCalled();
    });
  });

  it('should return 404 when there is no review', async () => {
    mockRepository.getReview.mockResolvedValue(null);

    await expect(
      service.getReview({
        chainId: faker.string.numeric(),
        safeTxHash: faker.string.hexadecimal({ length: 64 }) as Hex,
      }),
    ).rejects.toMatchObject({ status: 404, message: 'Review not found' });
  });
});
