import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [AccountsRepositoryModule],
  controllers: [],
  providers: [],
})
export class AccountsModule {}
