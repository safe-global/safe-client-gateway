import { Module } from '@nestjs/common';
import { EmailDataSourceModule } from '@/datasources/email/email.datasource.module';
import { IEmailRepository } from '@/domain/email/email.repository.interface';
import { EmailRepository } from '@/domain/email/email.repository';
import { EmailApiModule } from '@/datasources/email-api/email-api.module';

@Module({
  imports: [EmailDataSourceModule, EmailApiModule],
  providers: [{ provide: IEmailRepository, useClass: EmailRepository }],
  exports: [IEmailRepository],
})
export class EmailDomainModule {}
