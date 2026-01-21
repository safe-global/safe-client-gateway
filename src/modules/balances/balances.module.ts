import { Module } from '@nestjs/common';
import { BalancesApiManager } from '@/modules/balances/datasources/balances-api.manager';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import {
  IZerionBalancesApi,
  ZerionBalancesApi,
} from '@/modules/balances/datasources/zerion-balances-api.service';
import {
  IZerionWalletPortfolioApi,
  ZerionWalletPortfolioApi,
} from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import { CoingeckoApi } from '@/modules/balances/datasources/coingecko-api.service';
import { IPricesApi } from '@/modules/balances/datasources/prices-api.interface';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { BalancesRepository } from '@/modules/balances/domain/balances.repository';
import { IBalancesRepository } from '@/modules/balances/domain/balances.repository.interface';
import { BalancesController } from '@/modules/balances/routes/balances.controller';
import { BalancesService } from '@/modules/balances/routes/balances.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { ChainsModule } from '@/modules/chains/chains.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import { ZerionModule } from '@/modules/zerion/zerion.module';

@Module({
  imports: [
    ConfigApiModule,
    TransactionApiManagerModule,
    TxAuthNetworkModule,
    ChainsModule,
    SafeRepositoryModule,
    ZerionModule,
  ],
  controllers: [BalancesController],
  providers: [
    { provide: IBalancesApiManager, useClass: BalancesApiManager },
    { provide: IZerionBalancesApi, useClass: ZerionBalancesApi },
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
