// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { TenderlySimulationResult } from '@/domain/interfaces/tenderly-simulation-api.interface';
import { ITenderlySimulationApi } from '@/domain/interfaces/tenderly-simulation-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { SimulatedRelayer } from '@/modules/relay/domain/entities/relayer-type.entity';
import { RelaySimulationFailedError } from '@/modules/relay/domain/errors/relay-simulation-failed.error';
import { RelaySimulationIndeterminateError } from '@/modules/relay/domain/errors/relay-simulation-indeterminate.error';
import { SIMULATION_SENDER_SENTINEL } from '@/modules/relay/domain/relay.constants';

/**
 * The pre-relay Tenderly check, shared by every relayer that pays for what it
 * submits. Split in two so a caller with another independent round trip can
 * run them in parallel: {@link simulate} is the I/O, {@link assertRelayable}
 * the verdict.
 */
@Injectable()
export class RelaySimulationService {
  public constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(ITenderlySimulationApi)
    private readonly tenderlySimulationApi: ITenderlySimulationApi,
  ) {}

  /** `null` where the chain has the check switched off. */
  public async simulate(args: {
    enabled: boolean;
    chainId: string;
    to: Address;
    data: Hex;
  }): Promise<TenderlySimulationResult | null> {
    if (!args.enabled) {
      return null;
    }
    return await this.tenderlySimulationApi.simulate({
      chainId: args.chainId,
      from: SIMULATION_SENDER_SENTINEL,
      to: args.to,
      data: args.data,
    });
  }

  /**
   * Rejects a confirmed revert, and an unverifiable one the caller has not
   * accepted: an unreachable simulator must not decide on its own that a
   * transaction cannot be relayed.
   */
  public assertRelayable(args: {
    simulation: TenderlySimulationResult | null;
    relayer: SimulatedRelayer;
    chainId: string;
    to: Address;
    safeTxHash?: Hex;
    acceptUnverifiedSimulation?: boolean;
  }): void {
    const { simulation, relayer, chainId, to, safeTxHash } = args;

    if (simulation?.status === 'failed') {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `${relayer} relay denied for ${to} on chain ${chainId}: simulation failed (${simulation.reason}) for safeTxHash ${safeTxHash}`,
      });
      throw new RelaySimulationFailedError(safeTxHash, simulation.reason);
    }

    if (simulation?.status !== 'indeterminate') {
      return;
    }

    if (!args.acceptUnverifiedSimulation) {
      this.loggingService.warn({
        type: LogType.TxRelayEligibility,
        message: `${relayer} relay deferred for ${to} on chain ${chainId}: simulation indeterminate (${simulation.reason}) for safeTxHash ${safeTxHash}`,
      });
      throw new RelaySimulationIndeterminateError(
        safeTxHash,
        simulation.reason,
      );
    }

    this.loggingService.warn({
      type: LogType.TxRelayEligibility,
      message: `${relayer} relay proceeding for ${to} on chain ${chainId} despite indeterminate simulation (${simulation.reason}) for safeTxHash ${safeTxHash}: user override`,
    });
  }
}
