import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { TxAuthNetworkModule } from '@/datasources/network/tx-auth.network.module';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { BalancesApiManager } from '@/modules/balances/datasources/balances-api.manager';
import { CoingeckoApi } from '@/modules/balances/datasources/coingecko-api.service';
import { IPricesApi } from '@/modules/balances/datasources/prices-api.interface';
import {
  IZerionBalancesApi,
  ZerionBalancesApi,
} from '@/modules/balances/datasources/zerion-balances-api.service';
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

@Module({
  imports: [
    ConfigApiModule,
    TransactionApiManagerModule,
    TxAuthNetworkModule,
    ChainsModule,
    SafeRepositoryModule,
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
