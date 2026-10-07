// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { BadRequestException } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import { gtfFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/gtf-fees-response.builder';
import { txFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import type { IGasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository.interface';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import { FeesService } from '@/modules/fees/routes/fees.service';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

const mockFeeServiceApi = vi.mocked({
  canRelay: vi.fn(),
  getRelayFees: vi.fn(),
  getGtfFees: vi.fn(),
} as unknown as MockedObject<IFeeServiceApi>);

const mockGasTokensRepository = vi.mocked({
  getGasTokens: vi.fn(),
} as unknown as MockedObject<IGasTokensRepository>);

const mockChainsRepository = vi.mocked({
  getChain: vi.fn(),
} as unknown as MockedObject<IChainsRepository>);

describe('FeesService', () => {
  let target: FeesService;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new FeesService(
      mockFeeServiceApi,
      mockGasTokensRepository,
      mockChainsRepository,
    );
  });

  describe('getFeePreview', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const feePreviewDto = feePreviewTransactionDtoBuilder().build();

    it('should call getRelayFees and return a relay fee preview when PAY_FROM_SAFE is listed, whatever the relayer type is', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with(
          'relayer',
          relayerBuilder()
            .with(
              'type',
              faker.helpers.arrayElement([
                RelayerType.RELAY_FEE,
                RelayerType.DAILY_LIMIT,
                RelayerType.NO_FEE_CAMPAIGN,
                null,
              ]),
            )
            .with('gasPaymentOptions', [GasPaymentOption.PAY_FROM_SAFE])
            .build(),
        )
        .build();
      const txFeesResponse = txFeesResponseBuilder().build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);
      mockFeeServiceApi.getRelayFees.mockResolvedValueOnce(txFeesResponse);

      await target.getFeePreview({
        chainId,
        safeAddress,
        feePreviewDto,
      });

      expect(mockFeeServiceApi.getRelayFees).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        request: feePreviewDto,
      });
      expect(mockFeeServiceApi.getGtfFees).not.toHaveBeenCalled();
    });

    it('should call getGtfFees and return a GTF fee preview for GTF chains, whatever gas payment options are listed', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with(
          'relayer',
          relayerBuilder()
            .with('type', RelayerType.GTF)
            .with(
              'gasPaymentOptions',
              faker.helpers.arrayElements(Object.values(GasPaymentOption)),
            )
            .build(),
        )
        .build();
      const gtfFeesResponse = gtfFeesResponseBuilder().build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);
      mockFeeServiceApi.getGtfFees.mockResolvedValueOnce(gtfFeesResponse);

      await target.getFeePreview({
        chainId,
        safeAddress,
        feePreviewDto,
      });

      expect(mockFeeServiceApi.getGtfFees).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        request: feePreviewDto,
      });
      expect(mockFeeServiceApi.getRelayFees).not.toHaveBeenCalled();
    });

    it.each([
      [RelayerType.RELAY_FEE],
      [RelayerType.DAILY_LIMIT],
      [RelayerType.NO_FEE_CAMPAIGN],
      [null],
    ])(
      'should throw a BadRequestException when PAY_FROM_SAFE is not listed for relayer type %s',
      async (type) => {
        const chain = chainBuilder()
          .with('chainId', chainId)
          .with(
            'relayer',
            relayerBuilder()
              .with('type', type)
              .with(
                'gasPaymentOptions',
                faker.helpers.arrayElements(
                  [
                    GasPaymentOption.FREE_DAILY_LIMIT,
                    GasPaymentOption.NO_FEE_CAMPAIGN,
                    GasPaymentOption.SUBSCRIPTION,
                  ],
                  { min: 0, max: 3 },
                ),
              )
              .build(),
          )
          .build();
        mockChainsRepository.getChain.mockResolvedValueOnce(chain);

        await expect(
          target.getFeePreview({ chainId, safeAddress, feePreviewDto }),
        ).rejects.toThrow(
          new BadRequestException(
            'Fee preview is not available for this chain',
          ),
        );
        expect(mockFeeServiceApi.getRelayFees).not.toHaveBeenCalled();
        expect(mockFeeServiceApi.getGtfFees).not.toHaveBeenCalled();
      },
    );

    it('should throw a BadRequestException when the chain has no relayer', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('relayer', null)
        .build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);

      await expect(
        target.getFeePreview({ chainId, safeAddress, feePreviewDto }),
      ).rejects.toThrow(BadRequestException);
      expect(mockFeeServiceApi.getRelayFees).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.getGtfFees).not.toHaveBeenCalled();
    });
  });
});
