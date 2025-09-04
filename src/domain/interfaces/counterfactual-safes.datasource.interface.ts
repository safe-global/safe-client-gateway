import type { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import type { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import type { Account } from '@/domain/accounts/entities/account.entity';
import type { Address } from 'viem';

export const ICounterfactualSafesDatasource = Symbol(
  'ICounterfactualSafesDatasource',
);

export interface ICounterfactualSafesDatasource {
  createCounterfactualSafe(args: {
    account: Account;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafe(args: {
    address: Address;
    chainId: string;
    predictedAddress: Address;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafesForAddress(
    address: Address,
  ): Promise<Array<CounterfactualSafe>>;

  deleteCounterfactualSafe(args: {
    account: Account;
    chainId: string;
    predictedAddress: Address;
  }): Promise<void>;

  deleteCounterfactualSafesForAccount(account: Account): Promise<void>;
}
