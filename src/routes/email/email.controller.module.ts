import { Module } from '@nestjs/common';
import { AccountDomainModule } from '@/domain/account/account.domain.module';
import { EmailController } from '@/routes/email/email.controller';
import { EmailService } from '@/routes/email/email.service';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';

@Module({
  imports: [AccountDomainModule, SafeRepositoryModule],
  providers: [EmailService],
  controllers: [EmailController],
})
export class EmailControllerModule {}
