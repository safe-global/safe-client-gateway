import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SafeAppsRepository } from '../../../../domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '../../../../domain/safe-apps/safe-apps.repository.interface';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { SafeAppInfo } from '../../entities/safe-app-info.entity';

@Injectable()
export class SafeAppInfoMapper {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
  ) {}

  async mapSafeAppInfo(
    chainId: string,
    transaction: MultisigTransaction,
  ): Promise<SafeAppInfo | null> {
    const originUrl = this.getOriginUrl(transaction);
    if (!originUrl) {
      return null;
    }

    const [safeApp] = await this.safeAppsRepository.getSafeApps(
      chainId,
      undefined,
      originUrl,
    );

    if (!safeApp) {
      throw new NotFoundException('No Safe Apps match the url');
    }

    return new SafeAppInfo(safeApp.name, safeApp.url, safeApp.iconUrl);
  }

  private getOriginUrl(transaction: MultisigTransaction): string | null {
    if (!transaction.origin) {
      return null;
    }

    const parsedOrigin = JSON.parse(transaction.origin);
    return parsedOrigin?.url ?? null;
  }
}
