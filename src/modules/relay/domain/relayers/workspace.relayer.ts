// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { LogType } from '@/domain/common/entities/log-type.entity';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { IEntitlementEnforcement } from '@/modules/entitlements/domain/entitlement-enforcement.interface';
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';
import { NoRelayerDefinedError } from '@/modules/relay/domain/errors/no-relayer-defined.error';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';
import { RelayerTypeNotImplementedError } from '@/modules/relay/domain/errors/relayer-type-not-implemented.error';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelaySimulationService } from '@/modules/relay/domain/relay-simulation.service';
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

    // A chain we do not relay on at all. The type selects a policy this route
    // does not apply; only its presence is read here.
    if (!relayer?.type) {
      throw new NoRelayerDefinedError();
    }
    if (relayer.type === RelayerType.GTF) {
      throw new RelayerTypeNotImplementedError(relayer.type);
    }

    if (safe !== null) {
      await this.assertHoldsSafe({ ...args, safe });
    }

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
        enabled: relayer.enableTenderlySimulationBeforeRelay ?? false,
      });
    }

    const relay = await this.relayApi.relay({
      chainId: args.chainId,
      to: args.to,
      data: args.data,
      safeTxHash: args.safeTxHash,
    });

    // Recorded after the fact, as the daily-limit relayer counts, so nothing
    // is charged for a submission that never happened. A relay already made
    // cannot fail because the counter did.
    await this.entitlementEnforcement
      .recordUsage({
        spaceId: args.spaceId,
        featureKey: SPONSORED_TRANSACTIONS,
        delta: RELAYS_PER_CALL,
      })
      .catch((error: unknown) => {
        // Its own type, so an alert can key on it: we paid and did not charge.
        this.loggingService.error({
          type: LogType.QuotaNotRecorded,
          spaceId: args.spaceId,
          feature: SPONSORED_TRANSACTIONS,
          message: asError(error).message,
        });
      });

    return relay;
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
  private async assertHoldsSafe(args: {
    spaceId: Space['id'];
    chainId: string;
    safe: Address;
  }): Promise<void> {
    const holdsSafe = await this.spaceSafesRepository.existsInSpace({
      spaceId: args.spaceId,
      chainId: args.chainId,
      address: args.safe,
    });
    if (!holdsSafe) {
      throw new RelayDeniedError(args.safe, 'not a Safe of this workspace');
    }
  }
}
