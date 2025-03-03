import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { TransactionValidityError } from '@/routes/transactions/errors/transaction-validity.error';
import type { Response } from 'express';

@Catch(TransactionValidityError)
export class TransactionValidityExceptionFilter implements ExceptionFilter {
  constructor() {}

  catch(exception: TransactionValidityError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const statusCode = exception.getStatus();

    response.status(statusCode).json({
      statusCode,
      message: exception.message,
    });
  }
}
