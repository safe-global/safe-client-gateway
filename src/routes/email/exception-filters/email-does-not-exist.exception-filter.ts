import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { EmailAddressDoesNotExistError } from '@/datasources/email/errors/email-address-does-not-exist.error';

@Catch(EmailAddressDoesNotExistError)
export class EmailAddressDoesNotExistExceptionFilter
  implements ExceptionFilter
{
  catch(exception: EmailAddressDoesNotExistError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.NOT_FOUND).json({
      message: `No email address was found for the provided account ${exception.account}.`,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}
