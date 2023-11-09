import { Module } from '@nestjs/common';
import { EmailDataSource } from '@/datasources/email/email.datasource';
import { IEmailDataSource } from '@/domain/interfaces/email.datasource.interface';
import { PostgresDatabaseModule } from '@/datasources/db/postgres-database.module';

@Module({
  imports: [PostgresDatabaseModule],
  providers: [{ provide: IEmailDataSource, useClass: EmailDataSource }],
  exports: [IEmailDataSource],
})
export class EmailDatasourceModule {}
