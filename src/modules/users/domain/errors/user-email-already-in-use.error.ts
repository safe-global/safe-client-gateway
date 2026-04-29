// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException, HttpStatus } from '@nestjs/common';

export const USER_EMAIL_ALREADY_IN_USE_ERROR_CODE = 'user_email_already_in_use';

export class UserEmailAlreadyInUseError extends ConflictException {
  constructor() {
    super({
      code: USER_EMAIL_ALREADY_IN_USE_ERROR_CODE,
      message: 'Email already belongs to another user',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
