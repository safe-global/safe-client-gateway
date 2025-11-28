import { Module } from '@nestjs/common';
import { AccountsDatasourceModule } from '@/modules/accounts/datasources/accounts.datasource.module';
import { AddressBooksDatasourceModule } from '@/modules/accounts/datasources/address-books/address-books.datasource.module';
import { CounterfactualSafesDatasourceModule } from '@/modules/accounts/datasources/counterfactual-safes/counterfactual-safes.datasource.module';
import { AccountsRepositoryModule } from '@/modules/accounts/domain/accounts.repository.interface';
import { AddressBooksRepositoryModule } from '@/modules/accounts/domain/address-books/address-books.repository.interface';
import { CounterfactualSafesRepositoryModule } from '@/modules/accounts/domain/counterfactual-safes/counterfactual-safes.repository.interface';
import { AccountsModule as AccountsRoutesModule } from '@/modules/accounts/routes/accounts.module';

@Module({
  imports: [
    AccountsDatasourceModule,
    AddressBooksDatasourceModule,
    CounterfactualSafesDatasourceModule,
    AccountsRepositoryModule,
    AddressBooksRepositoryModule,
    CounterfactualSafesRepositoryModule,
    AccountsRoutesModule,
  ],
})
export class AccountsModule {}
