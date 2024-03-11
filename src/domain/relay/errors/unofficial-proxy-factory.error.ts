import { HttpException, HttpStatus } from '@nestjs/common';

export class UnofficialProxyFactoryError extends HttpException {
  constructor() {
    super(
      'ProxyFactory contract is not official. Only official ProxyFactory contracts are supported.',
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
