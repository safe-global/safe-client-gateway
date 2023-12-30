import { Module } from '@nestjs/common';
import { EmailDomainModule } from '@/domain/email/email.domain.module';
import { EmailController } from '@/routes/email/email.controller';
import { EmailService } from '@/routes/email/email.service';

@Module({
  imports: [EmailDomainModule],
  providers: [EmailService],
  controllers: [EmailController],
})
export class EmailControllerModule {}
