export class InvalidMultiSendError extends Error {
  constructor() {
    super(
      'Invalid `multiSend` call. The batch is not all `execTransaction` calls to same address.',
    );
  }
}
