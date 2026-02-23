// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { RelayRepository } from '@/modules/relay/domain/relay.repository';
import { RelayDto } from '@/modules/relay/routes/entities/relay.dto.entity';
import { Relay } from '@/modules/relay/routes/entities/relay.entity';
import { RelaysRemaining } from '@/modules/relay/routes/entities/relays-remaining.entity';
import type { Address } from 'viem';

@Injectable()
export class RelayService {
  constructor(private readonly relayRepository: RelayRepository) {}

  async relay(args: { chainId: string; relayDto: RelayDto }): Promise<Relay> {
    const relay = await this.relayRepository.relay({
      version: args.relayDto.version,
      chainId: args.chainId,
      to: args.relayDto.to,
      data: args.relayDto.data,
      gasLimit: args.relayDto.gasLimit,
    });

    return new Relay(relay);
  }

  async getRelaysRemaining(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<{ remaining: number; limit: number }> {
    const relaysRemaining = await this.relayRepository.getRelaysRemaining({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    return new RelaysRemaining(relaysRemaining);
  }
}
