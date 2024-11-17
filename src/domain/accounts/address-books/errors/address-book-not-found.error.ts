import { HttpException, HttpStatus } from '@nestjs/common';

export class AddressBookNotFoundError extends HttpException {
  constructor() {
    super(`Address Book not found`, HttpStatus.NOT_FOUND);
  }
}
