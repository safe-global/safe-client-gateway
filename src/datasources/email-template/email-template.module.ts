import { Module } from '@nestjs/common';
import { PushWooshTemplate } from '@/datasources/email-template/pushwoosh-template.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { IEmailTemplate } from '@/domain/interfaces/email-template.interface';

@Module({
  providers: [
    HttpErrorFactory,
    { provide: IEmailTemplate, useClass: PushWooshTemplate },
  ],
  exports: [IEmailTemplate],
})
export class EmailTemplateModule {}
