import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

enum TransactionValidityErrorType {
  MalformedHash = 'Could not calculate safeTxHash',
  HashMismatch = 'Invalid safeTxHash',
  DuplicateOwners = 'Duplicate owners in confirmations',
  DuplicateSignatures = 'Duplicate signatures in confirmations',
  UnrecoverableAddress = 'Could not recover address',
  InvalidSignature = 'Invalid signature',
  BlockedAddress = 'Unauthorized address',
  EthSignDisabled = 'eth_sign is disabled',
  DelegateCallDisabled = 'Delegate call is disabled',
}

export class TransactionValidityError extends HttpException {
  constructor(args: {
    code: HttpStatus;
    type: keyof typeof TransactionValidityErrorType;
  }) {
    super(TransactionValidityErrorType[args.type], args.code);
  }
}
