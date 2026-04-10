// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  Relay,
  RelaySchema,
} from '@/modules/relay/domain/entities/relay.entity';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';
import { RelayFeeConfiguration } from '@/modules/relay/domain/entities/relay.configuration';

@Injectable()
export class RelayFeeRelayer implements IRelayer {
  private readonly relayFeeConfiguration: RelayFeeConfiguration;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly limitAddressesMapper: LimitAddressesMapper,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
    @Inject(IFeeServiceApi) private readonly feeServiceApi: IFeeServiceApi,
  ) {
    this.relayFeeConfiguration = configurationService.getOrThrow('relay.fee');
  }

  /**
   * Checks whether the fee service permits relaying for the given Safe.
   * Uses a lightweight eligibility call (safe address as target, empty data).
   * Count-based limits are not tracked — the FeeEngine API is authoritative.
   *
   * @param args.chainId - Chain ID
   * @param args.address - Safe address to check
   * @param args.safeTxHash - Optional Safe transaction hash for relay-fee eligibility
   * @returns Result with currentCount=0 and limit=1 when eligible (mirrors getRelaysRemaining), or all zeros when denied
   */
  async canRelay(args: {
    chainId: string;
    address: Address;
    safeTxHash?: string;
  }): Promise<{ result: boolean; currentCount: number; limit: number }> {
    if (!this.relayFeeConfiguration.enabledChainIds.includes(args.chainId)) {
      return { result: false, currentCount: 0, limit: 0 };
    }

    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeAddress: args.address,
      // The FeeEngine API requires to, value, data - for canRelay checks
      // use the safe address as the target with empty data as a
      // lightweight eligibility check.
      to: args.address,
      value: '0',
      data: '0x',
      safeTxHash: args.safeTxHash,
    });

    if (!feeServiceResult.result) {
      this.loggingService.info(
        `relay-fee canRelay denied for ${args.address} on chain ${args.chainId}: ${feeServiceResult.reason ?? 'unknown reason'}`,
      );
      return { result: false, currentCount: 0, limit: 0 };
    }

    // relay-fee does not track count-based limits - the FeeEngine API is authoritative.
    // currentCount=0, limit=1 mirrors getRelaysRemaining.
    return { result: true, currentCount: 0, limit: 1 };
  }

  /**
   * Relays a transaction after verifying all limit addresses are eligible via the fee service.
   * Throws {@link RelayLimitReachedError} if any address is denied by the FeeEngine.
   *
   * @param args.version - Safe contract version
   * @param args.chainId - Chain ID
   * @param args.to - Transaction recipient address
   * @param args.data - Encoded transaction data
   * @param args.gasLimit - Gas limit, or null for automatic estimation
   * @param args.safeTxHash - Optional Safe transaction hash for relay-fee eligibility
   * @returns Relay result from the relay API
   */
  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    gasLimit: bigint | null;
    safeTxHash?: string;
  }): Promise<Relay> {
    const relayAddresses =
      await this.limitAddressesMapper.getLimitAddresses(args);

    for (const address of relayAddresses) {
      const feeServiceResult = await this.feeServiceApi.canRelay({
        chainId: args.chainId,
        safeAddress: address,
        to: args.to,
        value: '0',
        data: args.data,
        safeTxHash: args.safeTxHash,
      });

      if (!feeServiceResult.result) {
        this.loggingService.info(
          `relay-fee relay denied for ${address}: ${feeServiceResult.reason ?? 'unknown reason'}`,
        );
        throw new RelayDeniedError(address, feeServiceResult.reason);
      }
    }

    const relayResponse = await this.relayApi
      .relay(args)
      .then(RelaySchema.parse);

    return relayResponse;
  }

  /**
   * Returns a simplified relay budget view for the given Safe.
   * Returns `remaining=1, limit=1` when the FeeEngine permits relaying, or `0, 0` when denied.
   * Count tracking is not performed — the FeeEngine API is the authority on eligibility.
   *
   * @param args.chainId - Chain ID
   * @param args.address - Safe address to query
   * @returns Remaining relay count and limit (each 0 or 1)
   */
  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }> {
    if (!this.relayFeeConfiguration.enabledChainIds.includes(args.chainId)) {
      return { remaining: 0, limit: 0 };
    }

    // For relay-fee, the FeeEngine API is the authority on relay eligibility.
    // We report a simplified view: remaining=1 if eligible, 0 if not.
    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeAddress: args.address,
      to: args.address,
      value: '0',
      data: '0x',
    });

    return {
      remaining: feeServiceResult.result ? 1 : 0,
      limit: feeServiceResult.result ? 1 : 0,
    };
  }
}
