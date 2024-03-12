import { UnprocessableEntityException } from '@nestjs/common';

export class UnofficialMultiSendError extends UnprocessableEntityException {
  constructor() {
    super(
      'MultiSend contract is not official. Only official MultiSend contracts are supported.',
    );
  }
}
