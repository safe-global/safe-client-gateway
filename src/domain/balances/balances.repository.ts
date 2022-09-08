import { IBalancesRepository } from './balances.repository.interface';
import { Balance } from './entities/balance.entity';
import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { DefinedError, ValidateFunction } from 'ajv';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import {
  balanceTokenSchema,
  balanceSchema,
} from './entities/schemas/balance.schema';

@Injectable()
export class BalancesRepository implements IBalancesRepository {
  private readonly isValidBalance: ValidateFunction<Balance>;

  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validationErrorFactory: ValidationErrorFactory,
    private readonly jsonSchemaService: JsonSchemaService,
  ) {
    this.jsonSchemaService.addSchema(balanceTokenSchema, 'balanceToken');
    this.isValidBalance = this.jsonSchemaService.compile(
      balanceSchema,
    ) as ValidateFunction<Balance>;
  }

  async getBalances(
    chainId: string,
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const balances = await api.getBalances(safeAddress, trusted, excludeSpam);

    if (!balances.every((balance) => this.isValidBalance(balance))) {
      // TODO: probably we want to invalidate cache at this point
      const errors = this.isValidBalance.errors as DefinedError[];
      throw this.validationErrorFactory.from(errors);
    }

    return balances;
  }
}
