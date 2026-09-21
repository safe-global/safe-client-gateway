// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { ForbiddenException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import type { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { FeatureNotGrantedError } from '@/modules/entitlements/domain/errors/feature-not-granted.error';
import type { ISafeShieldAnalysis } from '@/modules/safe-shield/domain/safe-shield-analysis.interface';
import type { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';
import { SpaceSafeShieldService } from '@/modules/spaces/routes/safe-shield/space-safe-shield.service';
import type { Member } from '@/modules/users/domain/entities/member.entity';
import type { IMembersRepository } from '@/modules/users/domain/members/members.repository.interface';

describe('SpaceSafeShieldService', () => {
  const spaceId = faker.number.int({ min: 1, max: 100_000 });
  const userId = faker.number.int({ min: 1, max: 100_000 });
  const safe = {
    chainId: faker.string.numeric(),
    safeAddress: getAddress(faker.finance.ethereumAddress()),
  };
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', String(userId)).build(),
  );

  let spaceSafesRepository: MockedObject<
    Pick<ISpaceSafesRepository, 'existsInSpace'>
  >;
  let membersRepository: MockedObject<Pick<IMembersRepository, 'findOne'>>;
  let entitlementEnforcement: MockedObject<
    Pick<IEntitlementEnforcement, 'assertFeatureGranted'>
  >;
  let safeShieldAnalysis: MockedObject<ISafeShieldAnalysis>;
  let target: SpaceSafeShieldService;

  beforeEach(() => {
    spaceSafesRepository = { existsInSpace: vi.fn().mockResolvedValue(true) };
    membersRepository = {
      findOne: vi.fn().mockResolvedValue({ id: userId } as Member),
    };
    entitlementEnforcement = { assertFeatureGranted: vi.fn() };
    safeShieldAnalysis = {
      analyzeRecipient: vi.fn(),
      analyzeCounterparty: vi.fn(),
    };
    target = new SpaceSafeShieldService(
      spaceSafesRepository as MockedObject<ISpaceSafesRepository>,
      membersRepository as MockedObject<IMembersRepository>,
      entitlementEnforcement as MockedObject<IEntitlementEnforcement>,
      safeShieldAnalysis,
    );
  });

  describe('analyzeRecipient', () => {
    it('rejects a non-member before revealing the plan or the Safe registry', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        target.analyzeRecipient({
          spaceId,
          chainId: safe.chainId,
          safeAddress: safe.safeAddress,
          recipientAddress: getAddress(faker.finance.ethereumAddress()),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        entitlementEnforcement.assertFeatureGranted,
      ).not.toHaveBeenCalled();
      expect(spaceSafesRepository.existsInSpace).not.toHaveBeenCalled();
    });

    it('rejects a Space without the copilot_scans entitlement before checking the Safe registry', async () => {
      const notGranted = new FeatureNotGrantedError('copilot_scans');
      entitlementEnforcement.assertFeatureGranted.mockRejectedValue(notGranted);

      await expect(
        target.analyzeRecipient({
          spaceId,
          chainId: safe.chainId,
          safeAddress: safe.safeAddress,
          recipientAddress: getAddress(faker.finance.ethereumAddress()),
          authPayload,
        }),
      ).rejects.toThrow(notGranted);

      expect(
        entitlementEnforcement.assertFeatureGranted,
      ).toHaveBeenCalledExactlyOnceWith({
        spaceId,
        featureKey: 'copilot_scans',
      });
      expect(spaceSafesRepository.existsInSpace).not.toHaveBeenCalled();
    });

    it('rejects a Safe not registered to the Space', async () => {
      spaceSafesRepository.existsInSpace.mockResolvedValue(false);

      await expect(
        target.analyzeRecipient({
          spaceId,
          chainId: safe.chainId,
          safeAddress: safe.safeAddress,
          recipientAddress: getAddress(faker.finance.ethereumAddress()),
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(safeShieldAnalysis.analyzeRecipient).not.toHaveBeenCalled();
    });

    it('analyzes a recipient for a member within quota with a registered Safe', async () => {
      const recipientAddress = getAddress(faker.finance.ethereumAddress());
      const response = { isSafe: true } as Awaited<
        ReturnType<ISafeShieldAnalysis['analyzeRecipient']>
      >;
      safeShieldAnalysis.analyzeRecipient.mockResolvedValue(response);

      await expect(
        target.analyzeRecipient({
          spaceId,
          chainId: safe.chainId,
          safeAddress: safe.safeAddress,
          recipientAddress,
          authPayload,
        }),
      ).resolves.toBe(response);

      expect(membersRepository.findOne).toHaveBeenCalledExactlyOnceWith({
        user: { id: userId },
        space: { id: spaceId },
        status: 'ACTIVE',
      });
      expect(
        safeShieldAnalysis.analyzeRecipient,
      ).toHaveBeenCalledExactlyOnceWith(
        safe.chainId,
        safe.safeAddress,
        recipientAddress,
      );
    });
  });

  describe('analyzeCounterparty', () => {
    const tx = {
      to: getAddress(faker.finance.ethereumAddress()),
      value: faker.number.bigInt().toString(),
      data: '0x' as const,
      operation: 0 as const,
    };

    it('rejects a non-member before revealing the plan or the Safe registry', async () => {
      membersRepository.findOne.mockResolvedValue(null);

      await expect(
        target.analyzeCounterparty({
          spaceId,
          chainId: safe.chainId,
          safeAddress: safe.safeAddress,
          tx,
          authPayload,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(
        entitlementEnforcement.assertFeatureGranted,
      ).not.toHaveBeenCalled();
      expect(spaceSafesRepository.existsInSpace).not.toHaveBeenCalled();
    });

    it('analyzes counterparties for a member within quota with a registered Safe', async () => {
      const response = { recipient: {}, contract: {} } as Awaited<
        ReturnType<ISafeShieldAnalysis['analyzeCounterparty']>
      >;
      safeShieldAnalysis.analyzeCounterparty.mockResolvedValue(response);

      await expect(
        target.analyzeCounterparty({
          spaceId,
          chainId: safe.chainId,
          safeAddress: safe.safeAddress,
          tx,
          authPayload,
        }),
      ).resolves.toBe(response);

      expect(
        safeShieldAnalysis.analyzeCounterparty,
      ).toHaveBeenCalledExactlyOnceWith({
        chainId: safe.chainId,
        safeAddress: safe.safeAddress,
        tx,
      });
    });
  });
});
