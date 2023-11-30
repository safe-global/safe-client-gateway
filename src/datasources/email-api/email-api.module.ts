import { PushwooshApi } from '@/datasources/email-api/pushwoosh-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailApi } from '@/domain/interfaces/email-api.interface';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [HttpErrorFactory, { provide: IEmailApi, useClass: PushwooshApi }],
  exports: [IEmailApi],
})
export class EmailApiModule {}
