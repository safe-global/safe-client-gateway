import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { EmailUpdateMatchesError } from '@/domain/email/errors/email-update-matches.error';

@Catch(EmailUpdateMatchesError)
export class EmailUpdateMatchesExceptionFilter implements ExceptionFilter {
  catch(exception: EmailUpdateMatchesError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(HttpStatus.CONFLICT).json({
      message: 'Email address matches that of the Safe owner.',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
