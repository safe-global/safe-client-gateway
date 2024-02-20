import { Inject, Injectable } from '@nestjs/common';
import { RelayRepository } from '@/domain/relay/relay.repository';
import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';

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

  async relay(args: {
    chainId: string;
    relayDto: RelayDto;
  }): Promise<{ taskId: string }> {
    return this.relayRepository.relay({
      chainId: args.chainId,
      to: args.relayDto.to,
      data: args.relayDto.data,
      gasLimit: args.relayDto.gasLimit,
    });
  }

  async getRelaysRemaining(args: {
    chainId: string;
    safeAddress: string;
  }): Promise<{ remaining: number; limit: number }> {
    const currentCount = await this.relayRepository.getRelayCount({
      chainId: args.chainId,
      address: args.safeAddress,
    });

    return {
      remaining: Math.max(this.limit - currentCount, 0),
      limit: this.limit,
    };
  }
}
