import { UnprocessableEntityException } from '@nestjs/common';

export class InvalidMultiSendError extends UnprocessableEntityException {
  constructor() {
    super(
      'Invalid multiSend call. The batch is not all execTransaction calls to same address.',
    );
  }
}
