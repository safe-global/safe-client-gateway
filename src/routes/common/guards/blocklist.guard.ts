// SPDX-License-Identifier: FSL-1.1-MIT

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { getAddress, isAddress } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import {
  getRouteParam,
  getRoutePath,
  type HttpRequest,
} from '@/routes/common/http/http-request.utils';

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

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const addressParam = getRouteParam(request, this.parameterName);

    if (!(typeof addressParam === 'string' && isAddress(addressParam))) {
      return true;
    }

    try {
      const normalizedAddress = getAddress(addressParam);
      const blocklist = this.blocklistService.getBlocklist();

      if (blocklist.includes(normalizedAddress)) {
        this.loggingService.warn({
          type: LogType.BlocklistHit,
          address: normalizedAddress,
          route: getRoutePath(request),
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
