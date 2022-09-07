import { Global, Module } from '@nestjs/common';
import { TransactionApiManager } from './transaction-api.manager';
import { CacheFirstDataSourceModule } from '../cache/cache.first.data.source.module';
import { ITransactionApiManager } from '../../domain/interfaces/transaction-api.manager.interface';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';

@Global()
@Module({
  imports: [CacheFirstDataSourceModule],
  providers: [
    { provide: ITransactionApiManager, useClass: TransactionApiManager },
    ValidationErrorFactory,
    JsonSchemaService,
  ],
  exports: [ITransactionApiManager],
})
export class TransactionApiModule {}
