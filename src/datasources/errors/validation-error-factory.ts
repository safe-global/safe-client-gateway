import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DefinedError } from 'ajv';
import { HttpExceptionPayload } from './interfaces/http-exception-payload.interface';

/**
 * Creates an HttpException from an array of validation errors.
 * Both http status and internal error code are fixed.
 * Details about the validation error are logged but hidden from the client response.
 */
@Injectable()
export class ValidationErrorFactory {
  private readonly logger = new Logger(ValidationErrorFactory.name);
  private readonly VALIDATION_ERROR_CODE = 42;

  from(errors: DefinedError[]): HttpException {
    const errPayload: HttpExceptionPayload = {
      message: 'Validation failed',
      code: this.VALIDATION_ERROR_CODE,
      arguments: [],
    };

    const detail = errors.map((err) => JSON.stringify(err));
    this.logger.error({ ...errPayload, detail });
    return new HttpException(errPayload, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
