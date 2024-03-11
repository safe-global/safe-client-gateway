import { UnprocessableEntityException } from '@nestjs/common';

export class InvalidTransferError extends UnprocessableEntityException {
  constructor() {
    super(
      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
    );
  }
}
