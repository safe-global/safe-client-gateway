import { Global, Module } from '@nestjs/common';
import { ExchangeApiModule } from './datasources/exchange-api/exchange-api.module';
import { ConfigApiModule } from './datasources/config-api/config-api.module';
import { TransactionApiModule } from './datasources/transaction-api/transaction-api.module';
import { IBalancesRepository } from './domain/balances/balances.repository.interface';
import { BalancesRepository } from './domain/balances/balances.repository';
import { IChainsRepository } from './domain/chains/chains.repository.interface';
import { ChainsRepository } from './domain/chains/chains.repository';
import { IExchangeRepository } from './domain/exchange/exchange.repository.interface';
import { ExchangeRepository } from './domain/exchange/exchange.repository';
import { IBackboneRepository } from './domain/backbone/backbone.repository.interface';
import { BackboneRepository } from './domain/backbone/backbone.repository';
import { ValidationErrorFactory } from './domain/schema/validation-error-factory';
import { JsonSchemaService } from './domain/schema/json-schema.service';
import { ICollectiblesRepository } from './domain/collectibles/collectibles.repository.interface';
import { CollectiblesRepository } from './domain/collectibles/collectibles.repository';
import { ISafeRepository } from './domain/safe/safe.repository.interface';
import { SafeRepository } from './domain/safe/safe.repository';
import { BackboneValidator } from './domain/backbone/backbone.validator';
import { BalancesValidator } from './domain/balances/balances.validator';
import { ChainsValidator } from './domain/chains/chains.validator';
import { RatesExchangeResultValidator } from './domain/exchange/rates-exchange-result.validator';
import { FiatCodesExchangeResultValidator } from './domain/exchange/fiat-codes-exchange-result.validator';

@Global()
@Module({
  imports: [ConfigApiModule, ExchangeApiModule, TransactionApiModule],
  providers: [
    { provide: IBackboneRepository, useClass: BackboneRepository },
    { provide: IBalancesRepository, useClass: BalancesRepository },
    { provide: IChainsRepository, useClass: ChainsRepository },
    { provide: ICollectiblesRepository, useClass: CollectiblesRepository },
    { provide: IExchangeRepository, useClass: ExchangeRepository },
    { provide: ISafeRepository, useClass: SafeRepository },
    BackboneValidator,
    BalancesValidator,
    RatesExchangeResultValidator,
    FiatCodesExchangeResultValidator,
    ChainsValidator,
    ValidationErrorFactory,
    JsonSchemaService,
  ],
  exports: [
    IBackboneRepository,
    IBalancesRepository,
    IChainsRepository,
    ICollectiblesRepository,
    IExchangeRepository,
    ISafeRepository,
  ],
})
export class DomainModule {}
