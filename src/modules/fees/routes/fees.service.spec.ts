// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { type Address, getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import {
  gtfFeeBreakdownBuilder,
  gtfFeesResponseBuilder,
  gtfTxDataBuilder,
} from '@/modules/fees/domain/entities/__tests__/gtf-fees-response.builder';
import { txFeesResponseBuilder } from '@/modules/fees/domain/entities/__tests__/tx-fees-response.builder';
import type { GtfFeesResponse } from '@/modules/fees/domain/entities/gtf-fees-response.entity';
import type { IGasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository.interface';
import { feePreviewTransactionDtoBuilder } from '@/modules/fees/routes/entities/__tests__/fee-preview-transaction.dto.builder';
import { FeesService } from '@/modules/fees/routes/fees.service';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

const mockFeeServiceApi = vi.mocked({
  canRelay: vi.fn(),
  getRelayFees: vi.fn(),
  getGtfFees: vi.fn(),
  getGtfFeeSnapshot: vi.fn(),
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

    it('should forward safenetCheck when the user opts in on a chain with Safenet checks', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
        .with('features', ['ERC721', 'SAFENET_CHECKS'])
        .build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);
      mockFeeServiceApi.getGtfFees.mockResolvedValueOnce(
        gtfFeesResponseBuilder().build(),
      );

      await target.getFeePreview({
        chainId,
        safeAddress,
        feePreviewDto: { ...feePreviewDto, safenetCheck: true },
      });

      expect(mockFeeServiceApi.getGtfFees).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        request: { ...feePreviewDto, safenetCheck: true },
      });
    });

    it.each([
      ['the user opts in but the chain lacks the feature', ['ERC721'], true],
      [
        'the user does not choose on a chain with the feature',
        ['SAFENET_CHECKS'],
        undefined,
      ],
      [
        'the user opts out on a chain with the feature',
        ['SAFENET_CHECKS'],
        false,
      ],
      ['neither the user nor the chain opts in', ['ERC721'], undefined],
    ] as const)(
      'should omit safenetCheck when %s',
      async (_label, features, choice) => {
        const chain = chainBuilder()
          .with('chainId', chainId)
          .with(
            'relayer',
            relayerBuilder().with('type', RelayerType.GTF).build(),
          )
          .with('features', [...features])
          .build();
        mockChainsRepository.getChain.mockResolvedValueOnce(chain);
        mockFeeServiceApi.getGtfFees.mockResolvedValueOnce(
          gtfFeesResponseBuilder().build(),
        );

        await target.getFeePreview({
          chainId,
          safeAddress,
          feePreviewDto:
            choice === undefined
              ? feePreviewDto
              : { ...feePreviewDto, safenetCheck: choice },
        });

        expect(mockFeeServiceApi.getGtfFees).toHaveBeenCalledWith({
          chainId,
          safeAddress,
          request: feePreviewDto,
        });
      },
    );

    it('should not reach the fee service when the chain cannot be read', async () => {
      mockChainsRepository.getChain.mockRejectedValueOnce(
        new Error('Config Service unavailable'),
      );

      await expect(
        target.getFeePreview({ chainId, safeAddress, feePreviewDto }),
      ).rejects.toThrow('Config Service unavailable');
      expect(mockFeeServiceApi.getGtfFees).not.toHaveBeenCalled();
    });

    it('should drop a route DTO field that is outside the gtf/fees contract', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with('relayer', relayerBuilder().with('type', RelayerType.GTF).build())
        .with('features', ['SAFENET_CHECKS'])
        .build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);
      mockFeeServiceApi.getGtfFees.mockResolvedValueOnce(
        gtfFeesResponseBuilder().build(),
      );

      await target.getFeePreview({
        chainId,
        safeAddress,
        // fiatCode belongs to the relay flow, not to gtf/fees.
        feePreviewDto: {
          ...feePreviewDto,
          fiatCode: 'EUR',
          safenetCheck: true,
        },
      });

      expect(mockFeeServiceApi.getGtfFees).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        request: { ...feePreviewDto, safenetCheck: true },
      });
    });

    it('should not send safenetCheck on the relay flow of a Safenet chain', async () => {
      const chain = chainBuilder()
        .with('chainId', chainId)
        .with(
          'relayer',
          relayerBuilder().with('type', RelayerType.RELAY_FEE).build(),
        )
        .with('features', ['SAFENET_CHECKS'])
        .build();
      mockChainsRepository.getChain.mockResolvedValueOnce(chain);
      mockFeeServiceApi.getRelayFees.mockResolvedValueOnce(
        txFeesResponseBuilder().build(),
      );

      await target.getFeePreview({ chainId, safeAddress, feePreviewDto });

      expect(mockFeeServiceApi.getRelayFees).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        request: feePreviewDto,
      });
    });

    it.each([[RelayerType.DAILY_LIMIT], [RelayerType.NO_FEE_CAMPAIGN]])(
      'should throw a BadRequestException for unsupported relayer type %s',
      async (type) => {
        const chain = chainBuilder()
          .with('chainId', chainId)
          .with('relayer', relayerBuilder().with('type', type).build())
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

  describe('getFeePreviewBySafeTxHash', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeTxHash = faker.string.hexadecimal({
      length: 64,
      casing: 'lower',
    }) as Hex;

    const storedQuoteFor = (args: {
      chainId: string;
      safeAddress: Address;
    }): GtfFeesResponse =>
      gtfFeesResponseBuilder()
        .with('safeTxHash', safeTxHash)
        .with(
          'txData',
          gtfTxDataBuilder()
            .with('chainId', args.chainId)
            .with('safeAddress', args.safeAddress)
            .build(),
        )
        .with(
          'feeBreakdown',
          gtfFeeBreakdownBuilder()
            .with(
              'safenetFeeUsd',
              faker.number.float({ min: 0.01, max: 10, fractionDigits: 2 }),
            )
            .build(),
        )
        .build();

    it('should return the stored quote for the requested chain and Safe', async () => {
      const storedQuote = storedQuoteFor({ chainId, safeAddress });
      mockFeeServiceApi.getGtfFeeSnapshot.mockResolvedValueOnce(storedQuote);

      const result = await target.getFeePreviewBySafeTxHash({
        chainId,
        safeAddress,
        safeTxHash,
      });

      expect(mockFeeServiceApi.getGtfFeeSnapshot).toHaveBeenCalledWith({
        chainId,
        safeTxHash,
      });
      expect(result.relayCost).toBeUndefined();
      expect(result.feeBreakdown).toEqual(
        expect.objectContaining({
          totalUsd: storedQuote.feeBreakdown.totalUsd,
          safenetFeeUsd: storedQuote.feeBreakdown.safenetFeeUsd,
        }),
      );
      expect(result.maxFeeCapUsd).toBe(
        storedQuote.pricingContextSnapshot.maxFeeCapUsd,
      );
      expect(result.txData).toEqual(
        expect.objectContaining({ chainId, safeAddress }),
      );
    });

    it.each([
      ['another chain', { chainId: `${chainId}9` }],
      [
        'another Safe',
        { safeAddress: getAddress(faker.finance.ethereumAddress()) },
      ],
    ] as const)(
      'should throw a 404 when the stored quote is for %s',
      async (_label, scope) => {
        mockFeeServiceApi.getGtfFeeSnapshot.mockResolvedValueOnce(
          storedQuoteFor({ chainId, safeAddress, ...scope }),
        );

        await expect(
          target.getFeePreviewBySafeTxHash({
            chainId,
            safeAddress,
            safeTxHash,
          }),
        ).rejects.toThrow(
          new HttpExceptionNoLog('Fee quote not found', HttpStatus.NOT_FOUND),
        );
      },
    );
  });
});
