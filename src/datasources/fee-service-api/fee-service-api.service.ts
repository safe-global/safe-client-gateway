// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import {
  CacheService,
  ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { RelayFeeConfiguration } from '@/modules/relay/domain/entities/relay.configuration';
import type { TxFeesRequest } from '@/modules/transactions/domain/entities/relay-fee/tx-fees-request.dto';
import type { TxFeesResponse } from '@/modules/transactions/domain/entities/relay-fee/tx-fees-response.dto';
import {
  CanRelayResponseSchema,
  TxFeesResponseSchema,
} from '@/modules/transactions/domain/entities/relay-fee/schemas/tx-fees-response.schema';
import type { Address } from 'viem';

@Injectable()
export class FeeServiceApiService implements IFeeServiceApi {
  private readonly relayFeeConfiguration: RelayFeeConfiguration;

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.relayFeeConfiguration =
      this.configurationService.getOrThrow('relay.fee');
  }

  /**
   * Checks with the fee service whether a transaction can be relayed.
   *
   * @param args.chainId - Chain ID
   * @param args.safeAddress - Safe address initiating the relay
   * @param args.to - Transaction recipient address
   * @param args.value - Native value in wei
   * @param args.data - Encoded transaction data
   * @param args.safeTxHash - Optional Safe transaction hash for eligibility check
   * @returns Object indicating whether relay is allowed and an optional denial reason
   */
  async canRelay(args: {
    chainId: string;
    safeAddress: Address;
    to: Address;
    value: string;
    data: string;
    safeTxHash?: string;
  }): Promise<{ result: boolean; reason?: string }> {
    try {
      const url = `${this.relayFeeConfiguration.baseUri}/v1/fees/can-relay`;
      const { data: response } = await this.networkService.post<{
        result: boolean;
        reason?: string;
      }>({
        url,
        data: {
          chainId: args.chainId,
          safe: args.safeAddress,
          to: args.to,
          value: args.value,
          data: args.data,
          ...(args.safeTxHash && { safeTxHash: args.safeTxHash }),
        },
      });
      return CanRelayResponseSchema.parse(response);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Gets relay fees from the fee service with internal caching.
   * 1. Checks cache for existing fee response
   * 2. On cache miss: calls the external fee service API
   * 3. Stores the response in cache with configured TTL
   */
  async getRelayFees(args: {
    chainId: string;
    safeAddress: Address;
    request: TxFeesRequest;
  }): Promise<TxFeesResponse> {
    const cacheDir = CacheRouter.getRelayFeePreviewCacheDir({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      to: args.request.to,
      value: args.request.value,
      data: args.request.data,
      operation: args.request.operation,
      gasToken: args.request.gasToken,
      threshold: args.request.numberSignatures,
    });

    // 1. Check cache
    const cached = await this.cacheService.hGet(cacheDir);
    if (cached) {
      this.loggingService.debug(
        `Fee cache hit for ${args.safeAddress} on chain ${args.chainId}`,
      );
      return TxFeesResponseSchema.parse(JSON.parse(cached));
    }

    // 2. Cache miss — call fee service
    try {
      const url = `${this.relayFeeConfiguration.baseUri}/v1/chains/${args.chainId}/safes/${args.safeAddress}/transactions/relay-fees`;
      const { data: feeData } = await this.networkService.post<TxFeesResponse>({
        url,
        data: args.request,
      });
      const feeResponse = TxFeesResponseSchema.parse(
        feeData as unknown as TxFeesResponse,
      );

      // 3. Store in cache
      const feePreviewTtlSeconds =
        this.relayFeeConfiguration.feePreviewTtlSeconds;
      await this.cacheService.hSet(
        cacheDir,
        JSON.stringify(feeResponse),
        feePreviewTtlSeconds,
      );

      this.loggingService.info(
        feePreviewTtlSeconds > 0
          ? `relay-fee fees fetched and cached for ${args.safeAddress} on chain ${args.chainId}`
          : `relay-fee fees fetched for ${args.safeAddress} on chain ${args.chainId}; cache disabled`,
      );

      return feeResponse;
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Checks if 'Pay with Safe' is enabled for the given chain
   */
  isPayWithSafeEnabled(chainId: string): boolean {
    return this.relayFeeConfiguration.enabledChainIds.includes(chainId);
  }
}
