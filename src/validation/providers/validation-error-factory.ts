import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DefinedError } from 'ajv';
import { HttpExceptionPayload } from '../../datasources/errors/interfaces/http-exception-payload.interface';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';

/**
 * Creates an {@link HttpException} from an array of validation errors.
 * Both http status and internal error code are fixed.
 * Details about the validation error are logged but hidden from the client response.
 */
@Injectable()
export class ValidationErrorFactory {
  private readonly VALIDATION_ERROR_CODE = 42;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  from(errors: DefinedError[]): HttpException {
    const errPayload: HttpExceptionPayload = {
      message: 'Validation failed',
      code: this.VALIDATION_ERROR_CODE,
      arguments: [],
    };

    const detail = errors.map(({ instancePath, schemaPath, message }) => ({
      instancePath,
      schemaPath,
      message,
    }));

    this.loggingService.warn({ ...errPayload, detail });
    return new HttpException(errPayload, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
