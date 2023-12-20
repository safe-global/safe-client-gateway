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
  catch(exception: EmailAddressDoesNotExistError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.NOT_FOUND).json({
      message: 'The provided email address does not exist.',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}
