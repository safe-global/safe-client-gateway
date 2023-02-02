import { Inject, Injectable } from '@nestjs/common';
import { SafeAppsRepository } from '../../../../domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '../../../../domain/safe-apps/safe-apps.repository.interface';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';
import * as winston from 'winston';

@Injectable()
export class SafeAppInfoMapper {
  private static readonly IPFS_URL = 'ipfs.io';
  private static readonly CF_IPFS_URL = 'cloudflare-ipfs.com';

  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
  ) {}

  async mapSafeAppInfo(
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<SafeAppInfo | null> {
    const originUrl = this.getOriginUrl(transaction);
    if (!originUrl) return null;

    const [safeApp] = await this.safeAppsRepository.getSafeApps(
      chainId,
      undefined,
      originUrl,
    );
    if (!safeApp) {
      winston.warn(
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
    return transaction.origin
      ? JSON.parse(transaction.origin).url ?? null
      : null;
  }
}
