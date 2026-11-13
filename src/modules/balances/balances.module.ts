// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '#/datasources/config-api/config-api.module';
import { TxAuthNetworkModule } from '#/datasources/network/tx-auth.network.module';
import { IBalancesApiManager } from '#/domain/interfaces/balances-api.manager.interface';
import { BalancesApiManager } from '#/modules/balances/datasources/balances-api.manager';
import { PricesApiModule } from '#/modules/balances/datasources/prices-api.module';
import { ZerionWalletPortfolioApiModule } from '#/modules/balances/datasources/zerion-wallet-portfolio-api.module';
import { BalancesRepository } from '#/modules/balances/domain/balances.repository';
import { IBalancesRepository } from '#/modules/balances/domain/balances.repository.interface';
import { BalancesController } from '#/modules/balances/routes/balances.controller';
import { BalancesService } from '#/modules/balances/routes/balances.service';
import { ChainsModule } from '#/modules/chains/chains.module';
import { SafeRepositoryModule } from '#/modules/safe/domain/safe.repository.interface';

// Third-party clients live in their own modules: every provider declared here
// resolves the Transaction Service NetworkService from TxAuthNetworkModule.
@Module({
  imports: [
    ConfigApiModule,
    TxAuthNetworkModule,
    ChainsModule,
    SafeRepositoryModule,
    PricesApiModule,
    ZerionWalletPortfolioApiModule,
  ],
  controllers: [BalancesController],
  providers: [
    { provide: IBalancesApiManager, useClass: BalancesApiManager },
    {
      provide: IBalancesRepository,
      useClass: BalancesRepository,
    },
    BalancesService,
  ],
  exports: [
    IBalancesApiManager,
    IBalancesRepository,
    ZerionWalletPortfolioApiModule,
    BalancesService,
  ],
})
export class BalancesModule {}
