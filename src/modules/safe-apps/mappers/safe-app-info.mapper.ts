// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { SafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository';
import { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { parseOrigin } from '@/modules/queue/helpers/origin.helper';
import { SafeAppInfo } from '@/modules/transactions/routes/entities/safe-app-info.entity';

@Injectable()
export class SafeAppInfoMapper {
  private static readonly IPFS_URL = 'ipfs.io';
  private static readonly CF_IPFS_URL = 'cloudflare-ipfs.com';

  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async mapSafeAppInfo(
    chainId: string,
    origin: string | null,
    safeTxHash: string,
  ): Promise<SafeAppInfo | null> {
    const originUrl = this.getOriginUrl(origin, safeTxHash);
    if (!originUrl) return null;

    const [safeApp] = await this.safeAppsRepository.getSafeApps({
      chainId,
      onlyListed: false,
      url: originUrl,
    });
    if (!safeApp) {
      this.loggingService.info(
        `No Safe Apps matching the origin url ${originUrl} (safeTxHash: ${safeTxHash})`,
      );
      return null;
    }

    return new SafeAppInfo(
      safeApp.id,
      safeApp.name,
      safeApp.url.replace(
        SafeAppInfoMapper.IPFS_URL,
        SafeAppInfoMapper.CF_IPFS_URL,
      ),
      safeApp.iconUrl,
    );
  }

  private getOriginUrl(
    origin: string | null,
    safeTxHash: string,
  ): string | null {
    if (!origin) return null;
    const { originUrl } = parseOrigin(origin);
    if (!originUrl) {
      this.loggingService.debug(
        `Safe TX Hash ${safeTxHash} origin produced no URL. origin=${origin}`,
      );
      return null;
    }
    return originUrl;
  }
}
