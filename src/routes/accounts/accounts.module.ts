import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { CounterfactualSafesRepositoryModule } from '@/domain/accounts/counterfactual-safes/counterfactual-safes.repository.interface';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { AccountsController } from '@/routes/accounts/accounts.controller';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { CounterfactualSafesController } from '@/routes/accounts/counterfactual-safes/counterfactual-safes.controller';
import { CounterfactualSafesService } from '@/routes/accounts/counterfactual-safes/counterfactual-safes.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AccountsRepositoryModule,
    AuthRepositoryModule,
    CounterfactualSafesRepositoryModule,
  ],
  controllers: [AccountsController, CounterfactualSafesController],
  providers: [AccountsService, CounterfactualSafesService],
})
export class AccountsModule {}
