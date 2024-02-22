import {
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RelayRepository } from '@/domain/relay/relay.repository';
import { RelayDto } from '@/routes/relay/entities/relay.dto.entity';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';

@Injectable()
export class RelayService {
  // Number of relay requests per ttl
  private readonly limit: number;

  constructor(
    @Inject(IConfigurationService) configurationService: IConfigurationService,
    private readonly relayRepository: RelayRepository,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.limit = configurationService.getOrThrow('relay.limit');
  }

  async relay(args: {
    chainId: string;
    relayDto: RelayDto;
  }): Promise<{ taskId: string }> {
    return this.relayRepository.relay({
      version: args.relayDto.version,
      chainId: args.chainId,
      to: args.relayDto.to,
      data: args.relayDto.data,
      gasLimit: this.coerceGasLimit(args.relayDto.gasLimit),
    });
  }

  /**
   * As AJV does not support bigint, we cannot validate it without
   * a new keyword. To preserve type safety, it is instead validated
   * as a string and then manually coerced.
   */
  private coerceGasLimit(gasLimit: RelayDto['gasLimit']): bigint | null {
    if (!gasLimit) {
      return null;
    }

    try {
      return BigInt(gasLimit);
    } catch (error) {
      throw new UnprocessableEntityException('Invalid gas limit provided');
    }
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
