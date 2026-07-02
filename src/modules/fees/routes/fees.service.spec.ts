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

    it('should call getRelayFees and return a relay fee preview for RELAY_FEE chains', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with(
          'relayer',
          relayerBuilder().with('type', RelayerType.RELAY_FEE).build(),
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

    it('should call getGtfFees and return a GTF fee preview for GTF chains', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
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
      [RelayerType.DAILY_LIMIT],
      [RelayerType.NO_FEE_CAMPAIGN],
    ])('should throw a BadRequestException for unsupported relayer type %s', async (type) => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('relayer', relayerBuilder().with('type', type).build())
        .build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);

      await expect(
        target.getFeePreview({ chainId, safeAddress, feePreviewDto }),
      ).rejects.toThrow(
        new BadRequestException(
          `Accessing fee preview is only available for chains with ${RelayerType.RELAY_FEE} or ${RelayerType.GTF} relayer`,
        ),
      );
      expect(mockFeeServiceApi.getRelayFees).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.getGtfFees).not.toHaveBeenCalled();
    });

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

    it('should throw a BadRequestException when the relayer has no type', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('relayer', relayerBuilder().with('type', null).build())
        .build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);

      await expect(
        target.getFeePreview({ chainId, safeAddress, feePreviewDto }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
