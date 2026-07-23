// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ConflictException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { counterfactualSafeBuilder } from '@/modules/counterfactual-safes/datasources/entities/__tests__/counterfactual-safe.entity.db.builder';
import type { ICounterfactualSafesRepository } from '@/modules/counterfactual-safes/domain/counterfactual-safes.repository.interface';
import { CounterfactualSafesService } from '@/modules/counterfactual-safes/routes/counterfactual-safes.service';
import type { CreateCounterfactualSafeDto } from '@/modules/counterfactual-safes/routes/entities/create-counterfactual-safe.dto.entity';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

const mockCounterfactualSafesRepository = vi.mocked({
  create: vi.fn(),
} as MockedObject<ICounterfactualSafesRepository>);

const mockSafeRepository = vi.mocked({
  isSafe: vi.fn(),
} as MockedObject<ISafeRepository>);

function createDto(
  overrides?: Partial<CreateCounterfactualSafeDto>,
): CreateCounterfactualSafeDto {
  const safe = counterfactualSafeBuilder().build();
  return {
    chainId: safe.chainId,
    address: safe.address,
    factoryAddress: safe.factoryAddress,
    masterCopy: safe.masterCopy,
    saltNonce: safe.saltNonce,
    safeVersion: safe.safeVersion,
    threshold: safe.threshold,
    owners: safe.owners,
    fallbackHandler: safe.fallbackHandler,
    to: safe.setupTo,
    data: safe.setupData,
    paymentToken: safe.paymentToken,
    payment: safe.payment,
    paymentReceiver: safe.paymentReceiver,
    ...overrides,
  };
}

describe('CounterfactualSafesService', () => {
  let target: CounterfactualSafesService;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new CounterfactualSafesService(
      mockCounterfactualSafesRepository,
      mockSafeRepository,
    );
  });

  const authPayload = new AuthPayload(siweAuthPayloadDtoBuilder().build());

  describe('create', () => {
    it('persists when no safe in the batch is deployed', async () => {
      const payload = [createDto(), createDto()];
      mockSafeRepository.isSafe.mockResolvedValue(false);

      await target.create({ authPayload, payload });

      expect(mockCounterfactualSafesRepository.create).toHaveBeenCalledTimes(1);
    });

    it('rejects the whole request when any safe is already deployed', async () => {
      const deployed = createDto({
        address: getAddress(faker.finance.ethereumAddress()),
      });
      const undeployed = createDto({
        address: getAddress(faker.finance.ethereumAddress()),
      });
      mockSafeRepository.isSafe.mockImplementation(
        async ({ address }) => address === deployed.address,
      );

      await expect(
        target.create({ authPayload, payload: [undeployed, deployed] }),
      ).rejects.toThrow(ConflictException);
      expect(mockCounterfactualSafesRepository.create).not.toHaveBeenCalled();
    });

    it('persists (fail open) when the deployment check errors', async () => {
      const payload = [createDto()];
      mockSafeRepository.isSafe.mockRejectedValue(new Error('tx service down'));

      await target.create({ authPayload, payload });

      expect(mockCounterfactualSafesRepository.create).toHaveBeenCalledTimes(1);
    });
  });
});
