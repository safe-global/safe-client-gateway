import { HttpException, HttpStatus } from '@nestjs/common';

export class UnofficialMultiSendError extends HttpException {
  constructor() {
    super(
      'MultiSend contract is not official. Only official MultiSend contracts are supported.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
