import { Global, Module } from '@nestjs/common';
import { IDomainRepository } from './domain/domain.repository.interface';
import { DomainRepository } from './domain/domain.repository';
import { ExchangeApiModule } from './datasources/exchange-api/exchange-api.module';
import { ConfigApiModule } from './datasources/config-api/config-api.module';
import { TransactionApiModule } from './datasources/transaction-api/transaction-api.module';

@Global()
@Module({
  imports: [ConfigApiModule, ExchangeApiModule, TransactionApiModule],
  providers: [{ provide: IDomainRepository, useClass: DomainRepository }],
  exports: [IDomainRepository],
})
export class DomainModule {}
