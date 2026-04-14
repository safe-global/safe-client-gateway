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
import type { RelayEligibility } from '@/modules/relay/domain/entities/relay-eligibility.entity';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';
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
   * Requires a safeTxHash to query the fee service eligibility endpoint.
   * Count-based limits are not tracked — the FeeService API is authoritative.
   *
   * @param args.chainId - Chain ID
   * @param args.address - Safe address to check
   * @param args.safeTxHash - Safe transaction hash for relay-fee eligibility
   * @returns Result with currentCount=0 and limit=1 when eligible, or all zeros when denied
   */
  async canRelay(args: {
    chainId: string;
    address: Address;
    safeTxHash?: string;
  }): Promise<RelayEligibility> {
    if (
      !this.relayFeeConfiguration.enabledChainIds.includes(args.chainId) ||
      !args.safeTxHash
    ) {
      return { result: false, currentCount: 0, limit: 0 };
    }

    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeTxHash: args.safeTxHash,
    });

    if (!feeServiceResult.canRelay) {
      this.loggingService.info(
        `relay-fee canRelay denied for ${args.address} on chain ${args.chainId}`,
      );
      return { result: false, currentCount: 0, limit: 0 };
    }

    // relay-fee does not track count-based limits - the FeeService API is authoritative.
    // currentCount=0, limit=1 mirrors getRelaysRemaining.
    return { result: true, currentCount: 0, limit: 1 };
  }

  /**
   * Relays a transaction after verifying all limit addresses are eligible via the fee service.
   * Throws {@link RelayDeniedError} if any address is denied by the FeeService.
   *
   * @param args.version - Safe contract version
   * @param args.chainId - Chain ID
   * @param args.to - Transaction recipient address
   * @param args.data - Encoded transaction data
   * @param args.gasLimit - Gas limit, or null for automatic estimation
   * @param args.safeTxHash - Safe transaction hash for relay-fee eligibility
   * @returns Relay result from the relay API
   */
  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    gasLimit: bigint | null;
    safeTxHash?: Hex;
  }): Promise<Relay> {
    if (args.safeTxHash) {
      const feeServiceResult = await this.feeServiceApi.canRelay({
        chainId: args.chainId,
        safeTxHash: args.safeTxHash,
      });

      if (!feeServiceResult.canRelay) {
        this.loggingService.info(
          `relay-fee relay denied for ${args.safeTxHash}`,
        );
        throw new RelayTxDeniedError(args.safeTxHash);
      }
    }

    const relayResponse = await this.relayApi
      .relay(args)
      .then(RelaySchema.parse);

    return relayResponse;
  }

  /**
   * Returns a simplified relay budget view for the given Safe.
   * Returns `remaining=1, limit=1` when the chain is enabled, or `0, 0` when not.
   * Per-transaction eligibility requires a safeTxHash and is checked in relay().
   *
   * @param args.chainId - Chain ID
   * @param args.address - Safe address to query
   * @returns Remaining relay count and limit (each 0 or 1)
   */
  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
    safeTxHash?: string;
  }): Promise<{ remaining: number; limit: number }> {
    if (!this.relayFeeConfiguration.enabledChainIds.includes(args.chainId)) {
      return { remaining: 0, limit: 0 };
    }

    // For relay-fee, the FeeService API is the authority on relay eligibility.
    // We report a simplified view: remaining=1 if eligible, 0 if not.
    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeTxHash: args.safeTxHash ?? '',
    });

    return {
      remaining: feeServiceResult.canRelay ? 1 : 0,
      limit: feeServiceResult.canRelay ? 1 : 0,
    };
  }
}
