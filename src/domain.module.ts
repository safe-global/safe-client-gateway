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
import { ValidationErrorFactory } from './domain/errors/validation-error-factory';
import { JsonSchemaService } from './common/schemas/json-schema.service';
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
    { provide: IExchangeRepository, useClass: ExchangeRepository },
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
    IExchangeRepository,
  ],
})
export class DomainModule {}
