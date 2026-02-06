import { IConfigurationService } from '@/config/configuration.service.interface';
import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  LoggingService,
  type ILoggingService,
} from '@/logging/logging.interface';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAddress, isAddress } from 'viem';

@Injectable()
export class BlocklistGuard implements CanActivate {
  protected readonly parameterName: string = 'safeAddress';

  constructor(
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IBlocklistService)
    private readonly blocklistService: IBlocklistService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isBlocklistEnabled = this.configurationService.getOrThrow(
      'blockchain.blocklistEnabled',
    );

    if (!isBlocklistEnabled) {
      return true;
    }

    const request: Request = context.switchToHttp().getRequest();
    const addressParam = request.params[this.parameterName];

    if (!addressParam || !isAddress(addressParam)) {
      return true;
    }

    try {
      const normalizedAddress = getAddress(addressParam);
      const blocklist = this.blocklistService.getBlocklist();

      if (blocklist.includes(normalizedAddress)) {
        this.loggingService.warn({
          type: LogType.BlocklistHit,
          address: normalizedAddress,
          route: request.route?.path || request.path,
          method: request.method,
          clientIp: request.ip,
        });

        throw new ForbiddenException('Access to this Safe is restricted');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      // For any other error (e.g., address normalization), allow access
      // and let route validation handle invalid addresses
      return true;
    }
  }
}
