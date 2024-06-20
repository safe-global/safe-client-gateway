import { AccountsRepositoryModule } from '@/domain/accounts/accounts.repository.interface';
import { AccountsController } from '@/routes/accounts/accounts.controller';
import { AccountsService } from '@/routes/accounts/accounts.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [AccountsRepositoryModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
