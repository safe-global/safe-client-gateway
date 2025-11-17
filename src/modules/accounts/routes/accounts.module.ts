import { AccountsRepositoryModule } from '@/modules/accounts/domain/accounts.repository.interface';
import { AddressBooksRepositoryModule } from '@/modules/accounts/domain/address-books/address-books.repository.interface';
import { CounterfactualSafesRepositoryModule } from '@/modules/accounts/domain/counterfactual-safes/counterfactual-safes.repository.interface';
import { AuthRepositoryModule } from '@/modules/auth/domain/auth.repository.interface';
import { AccountsController } from '@/modules/accounts/routes/accounts.controller';
import { AccountsService } from '@/modules/accounts/routes/accounts.service';
import { AddressBooksController } from '@/modules/accounts/routes/address-books/address-books.controller';
import { AddressBooksService } from '@/modules/accounts/routes/address-books/address-books.service';
import { CounterfactualSafesController } from '@/modules/accounts/routes/counterfactual-safes/counterfactual-safes.controller';
import { CounterfactualSafesService } from '@/modules/accounts/routes/counterfactual-safes/counterfactual-safes.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AccountsRepositoryModule,
    AddressBooksRepositoryModule,
    AuthRepositoryModule,
    CounterfactualSafesRepositoryModule,
  ],
  controllers: [
    AccountsController,
    AddressBooksController,
    CounterfactualSafesController,
  ],
  providers: [AccountsService, AddressBooksService, CounterfactualSafesService],
})
export class AccountsModule {}
