export class UnofficialProxyFactoryError extends Error {
  constructor() {
    super(
      'ProxyFactory contract is not official. Only official ProxyFactory contracts are supported.',
    );
  }
}
