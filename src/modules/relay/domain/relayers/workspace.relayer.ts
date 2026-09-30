// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import {
  type ConsumedQuota,
  IEntitlementEnforcement,
} from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import { GasPaymentOptionUnavailableError } from '@/modules/relay/domain/errors/gas-payment-option-unavailable.error';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelaySimulationService } from '@/modules/relay/domain/relay-simulation.service';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';

/** One relay spends one unit, a batch included: we pay for the submission. */
const RELAYS_PER_CALL = 1;

const SPONSORED_TRANSACTIONS = 'sponsored_transactions';

/**
 * Relays at a workspace's expense, against the allowance its plan grants,
 * rather than against the per-address throttle the chain's own relayer
 * applies. Deliberately not an {@link IRelayer}: that contract is what
 * `RelayManager` dispatches over for a chain-configured relayer, and this one
 * is chosen by the route instead — it needs a workspace, and neither of the
 * contract's other two questions has a caller here.
 */
@Injectable()
export class WorkspaceRelayer {
  public constructor(
    private readonly limitAddressesMapper: LimitAddressesMapper,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
    @Inject(IEntitlementEnforcement)
    private readonly entitlementEnforcement: IEntitlementEnforcement,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafesRepository: ISpaceSafesRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly relaySimulationService: RelaySimulationService,
    private readonly relayTransactionHelper: RelayTransactionHelper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Admitted against the allowance before the call and recorded after it, so a
   * submission that never happened costs the workspace nothing. What the
   * allowance buys is the submission, not what it carries, and a submitted
   * transaction that later reverts is not refunded: the provider only reports
   * that outcome to whoever polls the task.
   */
  public async relay(args: {
    spaceId: Space['id'];
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    safeTxHash?: Hex;
    acceptUnverifiedSimulation?: boolean;
  }): Promise<Relay> {
    // `resolveTarget` also rejects unrecognised calldata and unofficial
    // deployments: the checks that make a relay safe to pay for.
    const [{ safe }, { relayer }] = await Promise.all([
      this.limitAddressesMapper.resolveTarget(args),
      this.chainsRepository.getChain(args.chainId),
    ]);

    if (!relayer) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.SUBSCRIPTION,
        reason: 'NO_RELAYER',
        available: [],
      });
    }
    const available = relayer.gasPaymentOptions;
    if (!available.includes(GasPaymentOption.SUBSCRIPTION)) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.SUBSCRIPTION,
        reason: 'NOT_LISTED',
        available,
      });
    }

    // The Safe would repay gas to the relayer on top of the credit spent.
    if (this.relayTransactionHelper.hasRefundingTransaction(args.data)) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.SUBSCRIPTION,
        reason: 'REFUNDING_TRANSACTION',
        available,
      });
    }

    if (safe !== null && !(await this.holdsSafe({ ...args, safe }))) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.SUBSCRIPTION,
        reason: 'NOT_A_WORKSPACE_SAFE',
        available,
      });
    }

    // Refused early; `consumeQuota` below is what decides.
    await this.entitlementEnforcement.assertWithinQuota({
      spaceId: args.spaceId,
      featureKey: SPONSORED_TRANSACTIONS,
      delta: RELAYS_PER_CALL,
    });

    // Only a transaction sent to the Safe itself, as on the public route: a
    // batch is addressed to MultiSend and a recovery to the DelayModifier,
    // and neither takes the direct call a simulation makes.
    if (safe !== null && safe === args.to) {
      await this.assertSimulates({
        ...args,
        safe,
        enabled: relayer.enableTenderlySimulationBeforeRelay,
      });
    }

    const spentQuota = await this.entitlementEnforcement.consumeQuota({
      spaceId: args.spaceId,
      featureKey: SPONSORED_TRANSACTIONS,
      delta: RELAYS_PER_CALL,
    });

    try {
      return await this.relayApi.relay({
        chainId: args.chainId,
        to: args.to,
        data: args.data,
        safeTxHash: args.safeTxHash,
      });
    } catch (error) {
      // No `taskId` came back, so nothing says it was submitted.
      if (error instanceof DataSourceError) {
        await this.refundAllowance(spentQuota);
      }
      throw error;
    }
  }

  /** Best effort: the error that sent us here is the one worth surfacing. */
  private async refundAllowance(spentQuota: ConsumedQuota): Promise<void> {
    await this.entitlementEnforcement
      .refundQuota(spentQuota)
      .catch((error: unknown) => {
        this.loggingService.error({
          type: LogType.QuotaNotRefunded,
          spaceId: spentQuota.spaceId,
          feature: SPONSORED_TRANSACTIONS,
          message: asError(error).message,
        });
      });
  }

  /**
   * Where the chain asks for it, what Tenderly says about the transaction
   * decides whether it is relayed at all.
   */
  private async assertSimulates(args: {
    enabled: boolean;
    chainId: string;
    safe: Address;
    data: Hex;
    safeTxHash?: Hex;
    acceptUnverifiedSimulation?: boolean;
  }): Promise<void> {
    const simulation = await this.relaySimulationService.simulate({
      enabled: args.enabled,
      chainId: args.chainId,
      to: args.safe,
      data: args.data,
    });
    this.relaySimulationService.assertRelayable({
      simulation,
      relayer: 'workspace',
      chainId: args.chainId,
      to: args.safe,
      safeTxHash: args.safeTxHash,
      acceptUnverifiedSimulation: args.acceptUnverifiedSimulation,
    });
  }

  /**
   * A workspace sponsors the Safes it holds. Calls with no Safe to attribute —
   * a Safe creation, a passkey signer deployment — are admitted as they are on
   * the public route: there is nothing to hold yet.
   */
  private async holdsSafe(args: {
    spaceId: Space['id'];
    chainId: string;
    safe: Address;
  }): Promise<boolean> {
    return await this.spaceSafesRepository.existsInSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safe,
    });
  }
}
