import { Inject, Injectable } from '@nestjs/common';
import { RelayRepository } from '@/domain/relay/relay.repository';
import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { Relay } from '@/routes/relay/entities/relay.entity';
import { RelaysRemaining } from '@/routes/relay/entities/relays-remaining.entity';

@Injectable()
export class RelayService {
  // Number of relay requests per ttl
  private readonly limit: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly relayRepository: RelayRepository,
  ) {
    this.limit = configurationService.getOrThrow('relay.limit');
  }

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
    safeAddress: `0x${string}`;
  }): Promise<{ remaining: number; limit: number }> {
    const currentCount = await this.relayRepository.getRelayCount({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    return new RelaysRemaining({
      remaining: Math.max(this.limit - currentCount, 0),
      limit: this.limit,
    });
  }
}
