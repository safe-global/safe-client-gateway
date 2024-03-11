import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidMultiSendError extends HttpException {
  constructor() {
    super(
      'Invalid multiSend call. The batch is not all execTransaction calls to same address.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
