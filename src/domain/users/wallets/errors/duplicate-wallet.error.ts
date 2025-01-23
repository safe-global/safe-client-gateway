import { ConflictException } from '@nestjs/common';

export class DuplicateWalletError extends ConflictException {
  constructor() {
    super('A wallet with the same address already exists');
  }
}
