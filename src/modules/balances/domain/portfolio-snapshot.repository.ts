// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IZerionWalletPortfolioApi } from '#/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import {
  type PortfolioSnapshot,
  PortfolioSnapshotSchema,
} from '#/modules/balances/domain/entities/portfolio-snapshot.entity';
import type { WalletPortfolioIdentity } from '#/modules/balances/domain/entities/wallet-portfolio-identity.entity';
import type { IPortfolioSnapshotRepository } from '#/modules/balances/domain/portfolio-snapshot.repository.interface';

@Injectable()
export class PortfolioSnapshotRepository
  implements IPortfolioSnapshotRepository
{
  constructor(
    @Inject(IZerionWalletPortfolioApi)
    private readonly zerionWalletPortfolioApi: IZerionWalletPortfolioApi,
  ) {}

  async getSnapshot(args: WalletPortfolioIdentity): Promise<PortfolioSnapshot> {
    const snapshot =
      await this.zerionWalletPortfolioApi.getPortfolioSnapshot(args);
    return PortfolioSnapshotSchema.parse(snapshot);
  }
}
