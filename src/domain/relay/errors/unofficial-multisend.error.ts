export class UnofficialMultiSendError extends Error {
  constructor() {
    super(
      'MultiSend contract is not official. Only official MultiSend contracts are supported.',
    );
  }
}
