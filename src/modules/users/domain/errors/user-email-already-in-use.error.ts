// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException, HttpStatus } from '@nestjs/common';

export const EMAIL_IN_USE_ERROR_CODE = 'email_in_use_error';

export class UserEmailAlreadyInUseError extends ConflictException {
  constructor() {
    super({
      code: EMAIL_IN_USE_ERROR_CODE,
      message: 'Email already belongs to another user',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
