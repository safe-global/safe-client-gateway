// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import type { RelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';

@Injectable()
export class RelayRepository {
  constructor(
    @Inject(IRelayManager) private readonly relayManager: IRelayManager,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Hex;
    gasLimit: bigint | null;
    safeTxHash?: Hex;
    acceptUnverifiedSimulation?: boolean;
  }): Promise<Relay> {
    const chain = await this.chainsRepository.getChain(args.chainId);
    return this.relayManager
      .getRelayer(chain.relayer?.type ?? null, args.data)
      .relay({
        ...args,
        simulationEnabled:
          chain.relayer?.enableTenderlySimulationBeforeRelay ?? false,
      });
  }

  getTaskStatus(args: {
    chainId: string;
    taskId: string;
  }): Promise<RelayTaskStatus> {
    return this.relayApi.getTaskStatus(args);
  }

  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
    safeTxHash?: Hex;
  }): Promise<{ remaining: number; limit: number }> {
    const chain = await this.chainsRepository.getChain(args.chainId);
    return this.relayManager
      .getRelayer(chain.relayer?.type ?? null)
      .getRelaysRemaining(args);
  }
}
