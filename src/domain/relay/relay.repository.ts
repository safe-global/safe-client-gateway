import { Inject, Injectable } from '@nestjs/common';
import { IRelayManager } from '@/domain/relay/interfaces/relay-manager.interface';
import { Relay } from '@/domain/relay/entities/relay.entity';
import type { Address } from 'viem';
import { chain } from 'lodash';

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
