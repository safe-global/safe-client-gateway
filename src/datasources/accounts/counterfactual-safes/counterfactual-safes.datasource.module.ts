import { CounterfactualSafesDatasource } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [
    {
      provide: ICounterfactualSafesDatasource,
      useClass: CounterfactualSafesDatasource,
    },
  ],
  exports: [ICounterfactualSafesDatasource],
})
export class CounterfactualSafesDatasourceModule {}
