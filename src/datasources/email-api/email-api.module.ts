import { PushwooshEmailApi } from '@/datasources/email-api/pushwoosh-email-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { Module } from '@nestjs/common';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IEmailApi, useClass: PushwooshEmailApi },
  ],
  exports: [IEmailApi],
})
export class EmailApiModule {}
