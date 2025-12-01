import { Module } from '@nestjs/common';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { PushwooshApi } from '@/modules/email/datasources/pushwoosh-api.service';

@Module({
  providers: [HttpErrorFactory, { provide: IEmailApi, useClass: PushwooshApi }],
  exports: [IEmailApi],
})
export class EmailModule {}
