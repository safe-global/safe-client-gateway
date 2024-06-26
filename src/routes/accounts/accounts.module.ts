import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { AuthRepositoryModule } from '@/domain/auth/auth.repository.interface';
import { AccountsController } from '@/routes/accounts/accounts.controller';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [AccountsRepositoryModule, AuthRepositoryModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
