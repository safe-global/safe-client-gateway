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
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
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

    // `null` only when the Config Service omits or malforms the relayer; a
    // chain without relaying lists no options, refused below with the rest.
    if (!relayer) {
      throw new NoRelayerDefinedError();
    }
    if (relayer.type === RelayerType.GTF) {
      throw new RelayerTypeNotImplementedError(relayer.type);
    }
    if (!relayer.gasPaymentOptions.includes(GasPaymentOption.SUBSCRIPTION)) {
      throw new NoRelayerDefinedError();
    }

    const sponsoredSafe = await this.getSponsoredSafe({ ...args, safe });

    // Refused early; `consumeQuota` below is what decides.
    await this.entitlementEnforcement.assertWithinQuota({
      spaceId: args.spaceId,
      featureKey: SPONSORED_TRANSACTIONS,
      delta: RELAYS_PER_CALL,
    });

    // Only a transaction sent to the Safe itself, as on the public route: a
    // batch is addressed to MultiSend and a recovery to the DelayModifier,
    // and neither takes the direct call a simulation makes.
    if (sponsoredSafe === args.to) {
      await this.assertSimulates({
        ...args,
        safe: sponsoredSafe,
        enabled: relayer.enableTenderlySimulationBeforeRelay ?? false,
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

  /**
   * The Safe whose workspace allowance pays for the call. Throws when the
   * allowance does not pay for it.
   */
  private async getSponsoredSafe(args: {
    spaceId: Space['id'];
    chainId: string;
    to: Address;
    data: Hex;
    safe: Address | null;
  }): Promise<Address> {
    // A Safe creation or a passkey signer deployment has no Safe to hold yet.
    if (args.safe === null) {
      throw new RelayDeniedError(args.to, 'not a Safe of this workspace');
    }
    // The Safe would repay gas to the relayer on top of the credit spent.
    if (this.relayTransactionHelper.hasRefundingTransaction(args.data)) {
      throw new NoRelayerDefinedError();
    }
    const holdsSafe = await this.spaceSafesRepository.existsInSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safe,
    });
    if (!holdsSafe) {
      throw new RelayDeniedError(args.safe, 'not a Safe of this workspace');
    }
    return args.safe;
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
}
