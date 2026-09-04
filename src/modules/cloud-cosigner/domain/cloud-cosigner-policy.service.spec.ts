// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { ICloudCosignerRepository } from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import { CloudCosignerPolicyService } from '@/modules/cloud-cosigner/domain/cloud-cosigner-policy.service';
import {
  cloudCosignerPolicyBuilder,
  safeCloudCosignerPolicyBuilder,
} from '@/modules/cloud-cosigner/domain/entities/__tests__/cloud-cosigner-policy.builder';
import type { CloudCosignerPolicy } from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import type { ICosignerSigner } from '@/modules/cloud-cosigner/domain/signers/cosigner-signer.interface';
import { buildPolicyMessage } from '@/modules/cloud-cosigner/domain/utils/policy-message';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

const mockLoggingService = {
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockRepository = {
  getPolicy: vi.fn(),
  upsertPolicy: vi.fn(),
  getReview: vi.fn(),
  claimReview: vi.fn(),
  completeReview: vi.fn(),
  failReview: vi.fn(),
} as MockedObject<ICloudCosignerRepository>;

const mockSigner = {
  getAddress: vi.fn(),
  signHash: vi.fn(),
} as MockedObject<ICosignerSigner>;

const mockSafeRepository = {
  isOwner: vi.fn(),
} as unknown as MockedObject<ISafeRepository>;

describe('CloudCosignerPolicyService', () => {
  const cosigner = privateKeyToAccount(generatePrivateKey());
  const owner = privateKeyToAccount(generatePrivateKey());
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const valueThresholdUsd = faker.number.int({ min: 1_000, max: 1_000_000 });
  const policySignatureMaxAgeSeconds = 300;
  let service: CloudCosignerPolicyService;

  beforeEach(() => {
    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'cloudCosigner.defaultPolicy.valueThresholdUsd',
      valueThresholdUsd,
    );
    configurationService.set(
      'cloudCosigner.defaultPolicy.reviewUnknownContracts',
      true,
    );
    configurationService.set(
      'cloudCosigner.policySignatureMaxAgeSeconds',
      policySignatureMaxAgeSeconds,
    );
    service = new CloudCosignerPolicyService(
      configurationService,
      mockLoggingService,
      mockRepository,
      mockSigner,
      mockSafeRepository,
    );
    mockSigner.getAddress.mockResolvedValue(cosigner.address);
    mockRepository.getPolicy.mockResolvedValue(null);
  });

  async function signed(args: {
    issuedAt: Date;
    policy?: CloudCosignerPolicy;
  }): Promise<{ policy: CloudCosignerPolicy; signature: Hex; issuedAt: Date }> {
    const policy = args.policy ?? cloudCosignerPolicyBuilder().build();
    const signature = await owner.signMessage({
      message: buildPolicyMessage({
        chainId,
        safeAddress,
        issuedAt: args.issuedAt.toISOString(),
        policy,
      }),
    });
    return { policy, signature, issuedAt: args.issuedAt };
  }

  describe('getEffectivePolicy', () => {
    it('should fall back to the configured defaults', async () => {
      await expect(
        service.getEffectivePolicy({ chainId, safeAddress }),
      ).resolves.toStrictEqual({
        valueThresholdUsd,
        reviewUnknownContracts: true,
        instructions: null,
      });
    });

    it('should return the stored policy fields only', async () => {
      const stored = safeCloudCosignerPolicyBuilder().build();
      mockRepository.getPolicy.mockResolvedValue(stored);

      await expect(
        service.getEffectivePolicy({ chainId, safeAddress }),
      ).resolves.toStrictEqual({
        valueThresholdUsd: stored.valueThresholdUsd,
        reviewUnknownContracts: stored.reviewUnknownContracts,
        instructions: stored.instructions,
      });
    });
  });

  describe('getSafeStatus', () => {
    it('should report enablement and the default policy', async () => {
      mockSafeRepository.isOwner.mockResolvedValue(true);

      await expect(
        service.getSafeStatus({ chainId, safeAddress }),
      ).resolves.toStrictEqual({
        cosignerAddress: cosigner.address,
        isEnabled: true,
        policy: {
          valueThresholdUsd,
          reviewUnknownContracts: true,
          instructions: null,
        },
        isDefaultPolicy: true,
      });
      expect(mockSafeRepository.isOwner).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        address: cosigner.address,
      });
    });

    it('should report disabled and warn when the Safe cannot be read', async () => {
      const stored = safeCloudCosignerPolicyBuilder().build();
      mockRepository.getPolicy.mockResolvedValue(stored);
      mockSafeRepository.isOwner.mockRejectedValue(new Error('upstream'));

      const status = await service.getSafeStatus({ chainId, safeAddress });

      expect(status.isEnabled).toBe(false);
      expect(status.isDefaultPolicy).toBe(false);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Could not read Safe owners: upstream',
        }),
      );
    });
  });

  describe('updatePolicy', () => {
    it('should store the policy for a fresh owner signature', async () => {
      const { policy, signature, issuedAt } = await signed({
        issuedAt: new Date(),
      });
      mockSafeRepository.isOwner.mockResolvedValue(true);
      const stored = safeCloudCosignerPolicyBuilder().build();
      mockRepository.upsertPolicy.mockResolvedValue(stored);

      await expect(
        service.updatePolicy({
          chainId,
          safeAddress,
          policy,
          signer: owner.address,
          signature,
          issuedAt,
        }),
      ).resolves.toBe(stored);

      expect(mockRepository.upsertPolicy).toHaveBeenCalledWith(
        expect.objectContaining({ chainId, safeAddress, policy }),
      );
    });

    it('should reject an expired signature before verifying it', async () => {
      const issuedAt = new Date(
        Date.now() - (policySignatureMaxAgeSeconds + 1) * 1_000,
      );
      const { policy, signature } = await signed({ issuedAt });

      await expect(
        service.updatePolicy({
          chainId,
          safeAddress,
          policy,
          signer: owner.address,
          signature,
          issuedAt,
        }),
      ).rejects.toThrow('Policy signature expired');
      expect(mockSafeRepository.isOwner).not.toHaveBeenCalled();
      expect(mockRepository.upsertPolicy).not.toHaveBeenCalled();
    });

    it('should reject a signature that does not match the policy', async () => {
      const { signature, issuedAt } = await signed({ issuedAt: new Date() });
      const tampered = cloudCosignerPolicyBuilder()
        .with('valueThresholdUsd', 1)
        .build();

      await expect(
        service.updatePolicy({
          chainId,
          safeAddress,
          policy: tampered,
          signer: owner.address,
          signature,
          issuedAt,
        }),
      ).rejects.toThrow('Invalid policy signature');
      expect(mockRepository.upsertPolicy).not.toHaveBeenCalled();
    });

    it('should reject a malformed signature as invalid', async () => {
      const policy = cloudCosignerPolicyBuilder().build();

      await expect(
        service.updatePolicy({
          chainId,
          safeAddress,
          policy,
          signer: owner.address,
          signature: '0x1234',
          issuedAt: new Date(),
        }),
      ).rejects.toThrow('Invalid policy signature');
    });

    it('should reject a valid signature from a non-owner', async () => {
      const { policy, signature, issuedAt } = await signed({
        issuedAt: new Date(),
      });
      mockSafeRepository.isOwner.mockResolvedValue(false);

      await expect(
        service.updatePolicy({
          chainId,
          safeAddress,
          policy,
          signer: owner.address,
          signature,
          issuedAt,
        }),
      ).rejects.toThrow('Signer is not an owner of the Safe');
      expect(mockRepository.upsertPolicy).not.toHaveBeenCalled();
    });
  });
});
