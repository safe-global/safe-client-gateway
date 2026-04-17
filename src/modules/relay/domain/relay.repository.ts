// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { Relay } from '@/modules/relay/domain/entities/relay.entity';
import type { RelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';

@Injectable()
export class RelayRepository {
  constructor(
    @Inject(IRelayManager) private readonly relayManager: IRelayManager,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
  ) {}

  relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
    gasLimit: bigint | null;
    safeTxHash?: Hex;
  }): Promise<Relay> {
    return this.relayManager.getRelayer(args.chainId).relay(args);
  }

  getTaskStatus(args: {
    chainId: string;
    taskId: string;
  }): Promise<RelayTaskStatus> {
    return this.relayApi.getTaskStatus(args);
  }

  getRelaysRemaining(args: {
    chainId: string;
    address: Address;
    safeTxHash?: Hex;
  }): Promise<{ remaining: number; limit: number }> {
    return this.relayManager.getRelayer(args.chainId).getRelaysRemaining(args);
  }
}
