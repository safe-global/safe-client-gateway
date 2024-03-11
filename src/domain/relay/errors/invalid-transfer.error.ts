export class InvalidTransferError extends Error {
  constructor() {
    super(
      'Invalid transfer. The proposed transfer is not an execTransaction/multiSend to another party or createProxyWithNonce call.',
    );
  }
}
