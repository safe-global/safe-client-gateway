// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import { Relay } from '@/modules/relay/domain/entities/relay.entity';
import type { RelayTaskStatus } from '@/modules/relay/domain/entities/relay-task-status.entity';
import type { Address } from 'viem';

@Injectable()
export class RelayRepository {
  constructor(
    @Inject(IRelayManager) private readonly relayManager: IRelayManager,
    @Inject(IRelayApi) private readonly relayApi: IRelayApi,
  ) {}

  async relay(args: {
    version: string;
    chainId: string;
    to: Address;
    data: Address;
    gasLimit: bigint | null;
  }): Promise<Relay> {
    return this.relayManager.getRelayer(args.chainId).relay(args);
  }

  async getTaskStatus(args: {
    chainId: string;
    taskId: string;
  }): Promise<RelayTaskStatus> {
    return this.relayApi.getTaskStatus(args);
  }

  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }> {
    return this.relayManager.getRelayer(args.chainId).getRelaysRemaining(args);
  }
}
