import { Module } from '@nestjs/common';
import { CacheFirstDataSourceModule } from '@/datasources/cache/cache.first.data.source.module';
import { BalancesApiManager } from '@/modules/balances/datasources/balances-api.manager';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import {
  IZerionBalancesApi,
  ZerionBalancesApi,
} from '@/modules/balances/datasources/zerion-balances-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
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

@Module({
  imports: [
    CacheFirstDataSourceModule,
    ConfigApiModule,
    TransactionApiManagerModule,
    ChainsModule,
    SafeRepositoryModule,
  ],
  controllers: [BalancesController],
  providers: [
    HttpErrorFactory,
    { provide: IBalancesApiManager, useClass: BalancesApiManager },
    { provide: IZerionBalancesApi, useClass: ZerionBalancesApi },
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
    BalancesService,
  ],
})
export class BalancesModule {}
