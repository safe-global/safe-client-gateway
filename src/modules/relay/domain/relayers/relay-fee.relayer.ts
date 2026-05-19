// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { ITenderlySimulationApi } from '@/domain/interfaces/tenderly-simulation-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { RelaySimulationConfiguration } from '@/modules/relay/domain/entities/relay.configuration';
import {
  type Relay,
  RelaySchema,
} from '@/modules/relay/domain/entities/relay.entity';
import type { RelayEligibility } from '@/modules/relay/domain/entities/relay-eligibility.entity';
import { RelaySimulationFailedError } from '@/modules/relay/domain/errors/relay-simulation-failed.error';
import { RelaySimulationIndeterminateError } from '@/modules/relay/domain/errors/relay-simulation-indeterminate.error';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import type { IRelayer } from '@/modules/relay/domain/interfaces/relayer.interface';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { SafeTransaction } from '@/modules/transactions/domain/entities/safe-transaction.entity';

/**
 * Placeholder EOA used as `from` when simulating a relayed `execTransaction`.
 * On-chain the caller is Gelato's dispatcher; using a non-Safe sentinel keeps
 * `msg.sender`/`tx.origin` distinct from the Safe so refund-receiver-zero
 * flows debit the Safe to a third party (as they would in production).
 */
const SIMULATION_SENDER_SENTINEL: Address =
  '0x000000000000000000000000000000000000dEaD';

@Injectable()
export class RelayFeeRelayer implements IRelayer {
  private readonly relaySimulationConfiguration: RelaySimulationConfiguration;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
    @Inject(IFeeServiceApi) private readonly feeServiceApi: IFeeServiceApi,
    @Inject(ITenderlySimulationApi)
    private readonly tenderlySimulationApi: ITenderlySimulationApi,
    private readonly relayTransactionHelper: RelayTransactionHelper,
  ) {
    this.relaySimulationConfiguration =
      configurationService.getOrThrow('relay.simulation');
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
    safeTxHash?: Hex;
  }): Promise<RelayEligibility> {
    if (!args.safeTxHash) {
      return { result: false, currentCount: 0, limit: 0 };
    }

    const feeServiceResult = await this.feeServiceApi.canRelay({
      chainId: args.chainId,
      safeTxHash: args.safeTxHash,
    });

    if (!feeServiceResult.canRelay) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee canRelay denied for ${args.address} on chain ${args.chainId}: fee service rejected safeTxHash ${args.safeTxHash}`,
      });
      return { result: false, currentCount: 0, limit: 0 };
    }

    // relay-fee does not track count-based limits - the FeeService API is authoritative.
    // currentCount=0, limit=1 mirrors getRelaysRemaining.
    return { result: true, currentCount: 0, limit: 1 };
  }

  /**
   * Relays a transaction after verifying eligibility via the fee service.
   *
   * @param args.version - Safe contract version
   * @param args.chainId - Chain ID
   * @param args.to - Transaction recipient address
   * @param args.data - Encoded transaction data
   * @param args.gasLimit - Gas limit, or null for automatic estimation
   * @param args.safeTxHash - Safe transaction hash for relay-fee eligibility
   * @returns Relay result from the relay API
   * @throws {@link RelayTxDeniedError} if no safeTxHash is provided for an execTransaction, the
   *   fee service rejects the safeTxHash, the execTransaction fails validity rules, the proxy
   *   factory is not an official deployment, or the transaction type is not recognised
   * @throws {@link SafeTxHashMismatchError} if the provided safeTxHash does not match the
   *   on-chain hash computed from the decoded execTransaction
   */
  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    gasLimit: bigint | null;
    safeTxHash?: Hex;
    acceptUnverifiedSimulation?: boolean;
  }): Promise<Relay> {
    const {
      version,
      chainId,
      to,
      data,
      safeTxHash,
      acceptUnverifiedSimulation,
    } = args;
    const decoded = this.relayTransactionHelper.decodeExecTransaction(data);

    // The relay request must match one of the supported transaction.
    // Each branch below handles one possible classification of the decoded data:
    if (
      decoded !== null &&
      this.relayTransactionHelper.isValidDecodedExecTransaction({ to, decoded })
    ) {
      // Branch 1: a valid execTransaction call on a Safe.
      // Verify the safeTxHash matches the decoded payload and that the fee
      // service permits relaying this specific transaction.
      await this.validateExecTransaction({
        chainId,
        to,
        data,
        decoded,
        safeTxHash: safeTxHash,
        acceptUnverifiedSimulation: acceptUnverifiedSimulation,
      });
    } else if (decoded !== null) {
      // Branch 2: the data decoded as execTransaction but failed validity rules.
      // e.g. Fee service rejected relaying because of not enough signatures.
      this.denyInvalidExecTransaction({
        to,
        chainId,
        safeTxHash: args.safeTxHash,
      });
    } else if (
      this.relayTransactionHelper.isValidCreateProxyWithNonceCall({
        version,
        chainId,
        data,
      })
    ) {
      // Branch 3: a Safe creation call (createProxyWithNonce) on a known
      // ProxyFactory. Confirm the target is an official deployment for the
      // given version + chain before relaying.
      this.validateSafeCreation({
        version,
        chainId,
        to,
      });
    } else {
      // Branch 4: data does not match any supported transaction types.
      // 1. Not a valid execTransaction call
      // 2. Not a valid createProxyWithNonce call.
      this.denyUnrecognisedTxType({ to, chainId, safeTxHash: args.safeTxHash });
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
    chainId: string;
    to: Address;
    data: Hex;
    decoded: SafeTransaction;
    safeTxHash: Hex | undefined;
    acceptUnverifiedSimulation: boolean | undefined;
  }): Promise<void> {
    const {
      chainId,
      to,
      data,
      decoded,
      safeTxHash,
      acceptUnverifiedSimulation,
    } = args;

    if (!safeTxHash) {
      throw new RelayTxDeniedError(undefined);
    }

    const isValid = await this.relayTransactionHelper.isSafeTxHashValid({
      chainId,
      safeAddress: to,
      decoded,
      safeTxHash,
    });

    if (!isValid) {
      throw new SafeTxHashMismatchError(safeTxHash);
    }

    // Fee-service eligibility and Tenderly simulation are independent — fire
    // them in parallel to avoid serializing two RTTs per relay.
    const simulationEnabled =
      this.relaySimulationConfiguration.enabledChainIds.includes(chainId);
    const [feeServiceResult, simulation] = await Promise.all([
      this.feeServiceApi.canRelay({ chainId, safeTxHash }),
      simulationEnabled
        ? this.tenderlySimulationApi.simulate({
            chainId,
            // Sentinel EOA — we use a non-Safe placeholder rather than the
            // Safe itself so that `msg.sender`/`tx.origin` ≠ Safe during
            // simulation. This surfaces issues that would only appear when
            // relayed by an external dispatcher (most notably: when
            // `refundReceiver` is the zero address, the refund is paid to
            // `tx.origin`; simulating with `from = Safe` would have the Safe
            // pay itself and hide insufficient token balance for the refund).
            from: SIMULATION_SENDER_SENTINEL,
            to,
            data,
          })
        : Promise.resolve(null),
    ]);

    // Fee-service denial takes precedence over a simulation failure to keep
    // the error class users see consistent with the previous serial flow.
    if (!feeServiceResult.canRelay) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee relay denied for ${to} on chain ${chainId}: fee service rejected safeTxHash ${safeTxHash}`,
      });
      throw new RelayTxDeniedError(safeTxHash);
    }

    if (simulation?.status === 'failed') {
      // Tenderly confirmed the transaction would revert => Block relay
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee relay denied for ${to} on chain ${chainId}: simulation failed (${simulation.reason}) for safeTxHash ${safeTxHash}`,
      });
      throw new RelaySimulationFailedError(safeTxHash, simulation.reason);
    }

    if (simulation?.status === 'indeterminate') {
      if (!acceptUnverifiedSimulation) {
        this.loggingService.warn({
          type: LogType.TxRelayEligibility,
          message: `relay-fee relay deferred for ${to} on chain ${chainId}: simulation indeterminate (${simulation.reason}) for safeTxHash ${safeTxHash}`,
        });
        throw new RelaySimulationIndeterminateError(
          safeTxHash,
          simulation.reason,
        );
      }

      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee relay proceeding for ${to} on chain ${chainId} despite indeterminate simulation (${simulation.reason}) for safeTxHash ${safeTxHash}: user override`,
      });
    }
  }

  private denyInvalidExecTransaction(args: {
    to: Address;
    chainId: string;
    safeTxHash: Hex | undefined;
  }): never {
    this.loggingService.warn({
      type: LogType.TxRelayEligibility,
      message: `relay-fee relay denied for invalid execTransaction: to=${args.to} on chain ${args.chainId}`,
    });
    throw new RelayTxDeniedError(args.safeTxHash);
  }

  private validateSafeCreation(args: {
    version: string;
    chainId: string;
    to: Address;
  }): void {
    const { version, chainId, to } = args;

    if (
      !this.relayTransactionHelper.isOfficialProxyFactoryDeployment({
        version,
        chainId,
        address: to,
      })
    ) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `relay-fee relay denied for unofficial proxy factory ${to} on chain ${chainId}`,
      });
      throw new UnofficialProxyFactoryError();
    }
  }

  private denyUnrecognisedTxType(args: {
    to: Address;
    chainId: string;
    safeTxHash: Hex | undefined;
  }): never {
    this.loggingService.warn({
      type: LogType.TxRelayEligibility,
      message: `relay-fee relay denied for unrecognised tx type: to=${args.to} on chain ${args.chainId}`,
    });
    throw new RelayTxDeniedError(args.safeTxHash);
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
    safeTxHash?: Hex;
  }): Promise<{ remaining: number; limit: number }> {
    // Without a safeTxHash we cannot query the fee service; report optimistically
    // since per-transaction eligibility is enforced in relay().
    if (!args.safeTxHash) {
      return { remaining: 1, limit: 1 };
    }

    // For relay-fee, the FeeService API is the authority on relay eligibility.
    // We report a simplified view: remaining=1 if eligible, 0 if not.
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
