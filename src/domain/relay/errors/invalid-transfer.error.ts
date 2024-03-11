import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidTransferError extends HttpException {
  constructor() {
    super(
      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
