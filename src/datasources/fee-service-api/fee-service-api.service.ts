// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  NetworkService,
  INetworkService,
} from '@/datasources/network/network.service.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { RelayFeeConfiguration } from '@/modules/relay/domain/entities/relay.configuration';
import type { CanRelayResponse } from '@/modules/fees/domain/entities/can-relay-response.entity';
import { CanRelayResponseSchema } from '@/modules/fees/domain/entities/schemas/can-relay-response.schema';
import type { TxFeesRequest } from '@/modules/fees/domain/entities/tx-fees-request.entity';
import type { TxFeesResponse } from '@/modules/fees/domain/entities/tx-fees-response.entity';
import { TxFeesResponseSchema } from '@/modules/fees/domain/entities/schemas/tx-fees-response.schema';
import type { Address, Hex } from 'viem';

@Injectable()
export class FeeServiceApi implements IFeeServiceApi {
  private readonly relayFeeConfiguration: RelayFeeConfiguration;
  private readonly notFoundExpireTimeSeconds: number;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.relayFeeConfiguration =
      this.configurationService.getOrThrow('relay.fee');
    this.notFoundExpireTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  /**
   * {@inheritdoc IFeeServiceApi.canRelay}
   *
   * Delegates directly to the fee service with no caching.
   */
  async canRelay(args: {
    chainId: string;
    safeTxHash: Hex;
  }): Promise<CanRelayResponse> {
    try {
      const url = `${this.relayFeeConfiguration.baseUri}/v1/chains/${args.chainId}/transactions/${args.safeTxHash}/can-relay`;
      const { data: response } = await this.networkService.get<{
        canRelay: boolean;
      }>({ url });
      return CanRelayResponseSchema.parse(response);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * {@inheritdoc IFeeServiceApi.getRelayFees}
   *
   * Uses {@link CacheFirstDataSource} keyed on chain, safe address, and
   * transaction parameters — serves from cache on hit, writes through on miss.
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
    const url = `${this.relayFeeConfiguration.baseUri}/v1/chains/${args.chainId}/safes/${args.safeAddress}/transactions/relay-fees`;

    try {
      const data = await this.dataSource.post<TxFeesResponse>({
        cacheDir,
        url,
        data: args.request,
        notFoundExpireTimeSeconds: this.notFoundExpireTimeSeconds,
        expireTimeSeconds: this.relayFeeConfiguration.feePreviewTtlSeconds,
      });
      return TxFeesResponseSchema.parse(data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }

  /** @inheritdoc */
  isPayWithSafeEnabled(chainId: string): boolean {
    return this.relayFeeConfiguration.enabledChainIds.includes(chainId);
  }
}
