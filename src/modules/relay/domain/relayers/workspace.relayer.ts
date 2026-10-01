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
import type { RelaySubmitter } from '@/modules/relay/domain/interfaces/relayer.interface';
import { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import { RelaySimulationService } from '@/modules/relay/domain/relay-simulation.service';
import type { Space } from '@/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '@/modules/spaces/domain/safes/space-safes.repository.interface';

/** One relay spends one unit, a batch included: we pay for the submission. */
const RELAYS_PER_CALL = 1;

const SPONSORED_TRANSACTIONS = 'sponsored_transactions';

/**
 * Relays against a workspace's plan allowance. The route hands `RelayManager`
 * a bound {@link RelaySubmitter} to fall back on.
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
   * The workspace's submitter for the call, which spends nothing until used.
   *
   * @throws GasPaymentOptionUnavailableError for a Safe the workspace doesn't hold.
   */
  public async forSpace(args: {
    spaceId: Space['id'];
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
  }): Promise<RelaySubmitter> {
    // `resolveTarget` also rejects unrecognised calldata and unofficial
    // deployments: the checks that make a relay safe to pay for.
    const [{ safe }, { relayer }] = await Promise.all([
      this.limitAddressesMapper.resolveTarget(args),
      this.chainsRepository.getChain(args.chainId),
    ]);

    // Refused whatever the chain lists: no route relays another's Safe here.
    if (safe !== null && !(await this.holdsSafe({ ...args, safe }))) {
      throw new GasPaymentOptionUnavailableError({
        requested: GasPaymentOption.SUBSCRIPTION,
        reason: 'NOT_A_WORKSPACE_SAFE',
        available: relayer?.gasPaymentOptions ?? [],
      });
    }

    return {
      relay: (relayArgs): Promise<Relay> =>
        this.relay({ ...relayArgs, spaceId: args.spaceId, safe }),
    };
  }

  /**
   * Admitted against the allowance before the call and recorded after it, so a
   * submission that never happened costs the workspace nothing. What the
   * allowance buys is the submission, not what it carries, and a submitted
   * transaction that later reverts is not refunded: the provider only reports
   * that outcome to whoever polls the task.
   */
  private async relay(
    args: Parameters<RelaySubmitter['relay']>[0] & {
      spaceId: Space['id'];
      safe: Address | null;
    },
  ): Promise<Relay> {
    // Refused early; `consumeQuota` below is what decides.
    await this.entitlementEnforcement.assertWithinQuota({
      spaceId: args.spaceId,
      featureKey: SPONSORED_TRANSACTIONS,
      delta: RELAYS_PER_CALL,
    });

    // Only a transaction sent to the Safe itself, as on the public route: a
    // batch is addressed to MultiSend and a recovery to the DelayModifier,
    // and neither takes the direct call a simulation makes.
    if (args.safe !== null && args.safe === args.to) {
      await this.assertSimulates({
        ...args,
        safe: args.safe,
        enabled: args.simulationEnabled ?? false,
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
