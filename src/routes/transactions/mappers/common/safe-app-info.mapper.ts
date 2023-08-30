import { Inject, Injectable } from '@nestjs/common';
import { SafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';

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
    transaction: MultisigTransaction,
  ): Promise<SafeAppInfo | null> {
    const originUrl = this.getOriginUrl(transaction);
    if (!originUrl) return null;

    const [safeApp] = await this.safeAppsRepository.getSafeApps({
      chainId,
      url: originUrl,
    });
    if (!safeApp) {
      this.loggingService.info(
        `No Safe Apps matching the origin url ${originUrl} (safeTxHash: ${transaction.safeTxHash})`,
      );
      return null;
    }

    return new SafeAppInfo(
      safeApp.name,
      safeApp.url.replace(
        SafeAppInfoMapper.IPFS_URL,
        SafeAppInfoMapper.CF_IPFS_URL,
      ),
      safeApp.iconUrl,
    );
  }

  private getOriginUrl(transaction: MultisigTransaction): string | null {
    try {
      return transaction.origin ? JSON.parse(transaction.origin).url : null;
    } catch (e) {
      this.loggingService.debug(
        `Safe TX Hash ${transaction.safeTxHash} origin is not valid JSON. origin=${transaction.origin}`,
      );
      return null;
    }
  }
}
