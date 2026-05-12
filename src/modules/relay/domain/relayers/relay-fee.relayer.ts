// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { RelayFeeConfiguration } from '@/modules/relay/domain/entities/relay.configuration';
import {
  type Relay,
  RelaySchema,
} from '@/modules/relay/domain/entities/relay.entity';
import type { RelayEligibility } from '@/modules/relay/domain/entities/relay-eligibility.entity';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';
import type { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { RelayClassifier } from '@/modules/relay/domain/validation/relay-classifier';
import { SafeTransaction } from '@/modules/transactions/domain/entities/safe-transaction.entity';

@Injectable()
export class RelayFeeRelayer implements IRelayer {
  private readonly relayFeeConfiguration: RelayFeeConfiguration;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
    @Inject(IFeeServiceApi) private readonly feeServiceApi: IFeeServiceApi,
    private readonly relayTransactionHelper: RelayTransactionHelper,
    private readonly classifier: RelayClassifier,
  ) {
    this.relayFeeConfiguration = configurationService.getOrThrow('relay.fee');
  }

  /**
   * Checks whether the fee service permits relaying for the given Safe.
   * Requires a safeTxHash to query the fee service eligibility endpoint.
   * Count-based limits are not tracked — the FeeService API is authoritative.
   */
  async canRelay(args: {
    chainId: string;
    address: Address;
    safeTxHash?: Hex;
  }): Promise<RelayEligibility> {
    if (
      !(
        this.relayFeeConfiguration.enabledChainIds.includes(args.chainId) &&
        args.safeTxHash
      )
    ) {
      return { result: false, currentCount: 0, limit: 0 };
    }

    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeTxHash: args.safeTxHash,
    });

    if (!feeServiceResult.canRelay) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee canRelay denied for ${args.address} on chain ${args.chainId}`,
      });
      return { result: false, currentCount: 0, limit: 0 };
    }

    // currentCount=0, limit=1 mirrors getRelaysRemaining.
    return { result: true, currentCount: 0, limit: 1 };
  }

  /**
   * Relays a transaction after verifying eligibility via the fee service.
   *
   * Validation goes through the shared {@link RelayClassifier} so domain
   * errors (e.g. unofficial multiSend, mismatched batch recipients) surface
   * with the same HTTP status (422) as for the daily-limit / no-fee-campaign
   * relayers. Once classified, relay-fee only sponsors execTransaction (with
   * a fee-service-approved safeTxHash) and createProxyWithNonce. Other valid
   * transaction shapes (recovery, multiSend, createSigner) are denied with
   * {@link RelayTxDeniedError} (403) — the classifier guarantees they're
   * structurally valid; we just don't sponsor them.
   */
  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    gasLimit: bigint | null;
    safeTxHash?: Hex;
  }): Promise<Relay> {
    const { version, chainId, to, data, safeTxHash } = args;
    const classification = await this.classifier.classify({
      version,
      chainId,
      to,
      data,
    });

    switch (classification.kind) {
      case 'execTransaction':
        await this.validateExecTransaction({
          version,
          chainId,
          to,
          decoded: classification.decoded,
          safeTxHash,
        });
        break;
      case 'createProxy':
        // The CreateProxyRule already verified the proxy factory is official;
        // no relay-fee-specific check is needed for Safe creation.
        break;
      case 'recovery':
      case 'multiSend':
      case 'createSigner':
        // Structurally valid but relay-fee doesn't sponsor these flows.
        this.loggingService.warn({
          type: LogType.TxRelayEligibility,
          message: `relay-fee relay denied for unsupported tx kind ${classification.kind}: to=${to} on chain ${chainId}`,
        });
        throw new RelayTxDeniedError(safeTxHash);
    }

    return this.relayApi
      .relay({
        chainId,
        to,
        data,
      })
      .then(RelaySchema.parse);
  }

  private async validateExecTransaction(args: {
    version: string;
    chainId: string;
    to: Address;
    decoded: SafeTransaction;
    safeTxHash: Hex | undefined;
  }): Promise<void> {
    const { version, chainId, to, decoded, safeTxHash } = args;

    if (!safeTxHash) {
      throw new RelayTxDeniedError(undefined);
    }

    const isValid = await this.relayTransactionHelper.isSafeTxHashValid({
      version,
      chainId,
      safeAddress: to,
      decoded,
      safeTxHash,
    });

    if (!isValid) {
      throw new SafeTxHashMismatchError(safeTxHash);
    }

    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId,
      safeTxHash,
    });

    if (!feeServiceResult.canRelay) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee relay denied for ${to} on chain ${chainId}: fee service rejected safeTxHash ${safeTxHash}`,
      });
      throw new RelayTxDeniedError(safeTxHash);
    }
  }

  /**
   * Returns a simplified relay budget view for the given Safe.
   * Returns `remaining=1, limit=1` when the chain is enabled, or `0, 0` when not.
   * Per-transaction eligibility requires a safeTxHash and is checked in relay().
   */
  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
    safeTxHash?: Hex;
  }): Promise<{ remaining: number; limit: number }> {
    if (!this.relayFeeConfiguration.enabledChainIds.includes(args.chainId)) {
      return { remaining: 0, limit: 0 };
    }

    // Without a safeTxHash we cannot query the fee service; report optimistically
    // since per-transaction eligibility is enforced in relay().
    if (!args.safeTxHash) {
      return { remaining: 1, limit: 1 };
    }

    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeTxHash: args.safeTxHash,
    });

    return {
      remaining: feeServiceResult.canRelay ? 1 : 0,
      limit: feeServiceResult.canRelay ? 1 : 0,
    };
  }
}
