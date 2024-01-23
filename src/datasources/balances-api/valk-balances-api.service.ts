import { Balance } from '@/domain/balances/entities/balance.entity';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { Injectable } from '@nestjs/common';

export const IValkBalancesApi = Symbol('IValkBalancesApi');

@Injectable()
export class ValkBalancesApi implements IBalancesApi {
  getBalances(): Promise<Balance[]> {
    throw new Error('Method not implemented.');
  }
  clearBalances(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
