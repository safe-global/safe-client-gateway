// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import type { z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import {
  type CanRelayResponse,
  CanRelayResponseSchema,
} from '@/modules/fees/domain/entities/can-relay-response.entity';
import {
  type GtfFeesRequest,
  GtfFeesRequestSchema,
} from '@/modules/fees/domain/entities/gtf-fees-request.entity';
import {
  type GtfFeesResponse,
  GtfFeesResponseSchema,
} from '@/modules/fees/domain/entities/gtf-fees-response.entity';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import {
  type TxFeesRequest,
  TxFeesRequestSchema,
} from '@/modules/fees/domain/entities/tx-fees-request.entity';
import {
  type TxFeesResponse,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/tx-fees-response.entity';
import type { RelayFeeConfiguration } from '@/modules/relay/domain/entities/relay.configuration';

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
  getRelayFees(args: {
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
      nonce: args.request.nonce,
      origin: args.request.origin,
      fiatCode: args.request.fiatCode,
    });
    const url = `${this.relayFeeConfiguration.baseUri}/v1/chains/${args.chainId}/safes/${args.safeAddress}/transactions/relay/fees`;

    return this.postFeeRequest({
      cacheDir,
      url,
      // parsed to strip fields outside this endpoint's contract.
      data: TxFeesRequestSchema.parse({
        ...args.request,
        origin: args.request.origin ?? Origin.NATIVE,
      }),
      responseSchema: TxFeesResponseSchema,
    });
  }

  /**
   * {@inheritdoc IFeeServiceApi.getGtfFees}
   *
   * Uses {@link CacheFirstDataSource} keyed on chain, safe address, and
   * transaction parameters — serves from cache on hit, writes through on miss.
   */
  getGtfFees(args: {
    chainId: string;
    safeAddress: Address;
    request: GtfFeesRequest;
  }): Promise<GtfFeesResponse> {
    const cacheDir = CacheRouter.getGtfFeePreviewCacheDir({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      to: args.request.to,
      value: args.request.value,
      data: args.request.data,
      operation: args.request.operation,
      nonce: args.request.nonce,
      gasToken: args.request.gasToken,
      threshold: args.request.numberSignatures,
      origin: args.request.origin,
    });
    const url = `${this.relayFeeConfiguration.baseUri}/v1/chains/${args.chainId}/safes/${args.safeAddress}/transactions/gtf/fees`;

    return this.postFeeRequest({
      cacheDir,
      url,
      // origin is mandatory for this fee endpoint; parsed to strip fields outside its contract.
      data: GtfFeesRequestSchema.parse({
        ...args.request,
        origin: args.request.origin ?? Origin.NATIVE,
      }),
      responseSchema: GtfFeesResponseSchema,
    });
  }

  private async postFeeRequest<TResponse, TRequest extends object>(args: {
    cacheDir: CacheDir;
    url: string;
    data: TRequest;
    responseSchema: z.ZodType<TResponse>;
  }): Promise<TResponse> {
    try {
      const data = await this.dataSource.post<TResponse>({
        cacheDir: args.cacheDir,
        url: args.url,
        data: args.data,
        notFoundExpireTimeSeconds: this.notFoundExpireTimeSeconds,
        expireTimeSeconds: this.relayFeeConfiguration.feePreviewTtlSeconds,
      });
      return args.responseSchema.parse(data);
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }
  }
}
