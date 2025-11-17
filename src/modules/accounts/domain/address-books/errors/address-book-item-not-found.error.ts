import { HttpException, HttpStatus } from '@nestjs/common';

export class AddressBookItemNotFoundError extends HttpException {
  constructor() {
    super(`Address Book Item not found`, HttpStatus.NOT_FOUND);
  }
}
