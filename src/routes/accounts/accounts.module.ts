import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { AddressBooksRepositoryModule } from '@/domain/accounts/address-books/address-books.repository.interface';
import { CounterfactualSafesRepositoryModule } from '@/domain/accounts/counterfactual-safes/counterfactual-safes.repository.interface';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { AccountsController } from '@/routes/accounts/accounts.controller';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { AddressBooksController } from '@/routes/accounts/address-books/address-books.controller';
import { AddressBooksService } from '@/routes/accounts/address-books/address-books.service';
import { CounterfactualSafesController } from '@/routes/accounts/counterfactual-safes/counterfactual-safes.controller';
import { CounterfactualSafesService } from '@/routes/accounts/counterfactual-safes/counterfactual-safes.service';
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
