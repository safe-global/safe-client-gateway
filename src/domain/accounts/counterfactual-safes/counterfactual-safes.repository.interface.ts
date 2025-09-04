import { CounterfactualSafesDatasourceModule } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource.module';
import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { CounterfactualSafesRepository } from '@/domain/accounts/counterfactual-safes/counterfactual-safes.repository';
import { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { Module } from '@nestjs/common';
import type { Address } from 'viem';

export const ICounterfactualSafesRepository = Symbol(
  'ICounterfactualSafesRepository',
);

export interface ICounterfactualSafesRepository {
  getCounterfactualSafe(args: {
    address: Address;
    chainId: string;
    predictedAddress: Address;
  }): Promise<CounterfactualSafe>;

  getCounterfactualSafes(address: Address): Promise<Array<CounterfactualSafe>>;

  createCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: Address;
    createCounterfactualSafeDto: CreateCounterfactualSafeDto;
  }): Promise<CounterfactualSafe>;

  deleteCounterfactualSafe(args: {
    authPayload: AuthPayload;
    address: Address;
    chainId: string;
    predictedAddress: Address;
  }): Promise<void>;

  deleteCounterfactualSafes(args: {
    authPayload: AuthPayload;
    address: Address;
  }): Promise<void>;
}

@Module({
  imports: [AccountsRepositoryModule, CounterfactualSafesDatasourceModule],
  providers: [
    {
      provide: ICounterfactualSafesRepository,
      useClass: CounterfactualSafesRepository,
    },
  ],
  exports: [ICounterfactualSafesRepository],
})
export class CounterfactualSafesRepositoryModule {}
