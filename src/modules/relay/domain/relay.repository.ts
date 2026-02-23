// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IRelayManager } from '@/modules/relay/domain/interfaces/relay-manager.interface';
import { type Relay } from '@/modules/relay/domain/entities/relay.entity';
import type { Address } from 'viem';

@Injectable()
export class RelayRepository {
  constructor(
    @Inject(IRelayManager) private readonly relayManager: IRelayManager,
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

  async getRelaysRemaining(args: {
    chainId: string;
    address: Address;
  }): Promise<{ remaining: number; limit: number }> {
    return this.relayManager.getRelayer(args.chainId).getRelaysRemaining(args);
  }
}
