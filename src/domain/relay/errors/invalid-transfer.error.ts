export class InvalidTransferError extends Error {
  constructor() {
    super(
      'Invalid transfer. The proposed transfer is not an execTransaction, multiSend, or createProxyWithNonce call.',
    );
  }
}
