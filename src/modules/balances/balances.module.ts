// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { BalancesApiManager } from '@/modules/balances/datasources/balances-api.manager';
import { CoingeckoApi } from '@/modules/balances/datasources/coingecko-api.service';
import { IPricesApi } from '@/modules/balances/datasources/prices-api.interface';
import {
  IZerionWalletPortfolioApi,
  ZerionWalletPortfolioApi,
} from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import { BalancesRepository } from '@/modules/balances/domain/balances.repository';
import { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import { BalancesController } from '@/modules/balances/routes/balances.controller';
import { BalancesService } from '@/modules/balances/routes/balances.service';
import { ChainsModule } from '@/modules/chains/chains.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { ZerionModule } from '@/modules/zerion/zerion.module';

@Module({
  imports: [
    ConfigApiModule,
    TxAuthNetworkModule,
    ChainsModule,
    SafeRepositoryModule,
    ZerionModule,
  ],
  controllers: [BalancesController],
  providers: [
    { provide: IBalancesApiManager, useClass: BalancesApiManager },
    { provide: IZerionWalletPortfolioApi, useClass: ZerionWalletPortfolioApi },
    { provide: IPricesApi, useClass: CoingeckoApi },
    {
      provide: IBalancesRepository,
      useClass: BalancesRepository,
    },
    BalancesService,
  ],
  exports: [
    IBalancesApiManager,
    IBalancesRepository,
    IZerionWalletPortfolioApi,
    BalancesService,
  ],
})
export class BalancesModule {}
