import { UnprocessableEntityException } from '@nestjs/common';

export class UnofficialProxyFactoryError extends UnprocessableEntityException {
  constructor() {
    super(
      'ProxyFactory contract is not official. Only official ProxyFactory contracts are supported.',
    );
  }
}
