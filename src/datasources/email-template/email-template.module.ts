import { Module } from '@nestjs/common';
import { PushwooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IEmailTemplate, useClass: PushwooshTemplate },
  ],
  exports: [IEmailTemplate],
})
export class EmailTemplateModule {}
