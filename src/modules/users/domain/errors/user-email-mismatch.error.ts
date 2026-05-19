// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, UnauthorizedException } from '@nestjs/common';

export const EMAIL_MISMATCH_ERROR_CODE = 'email_mismatch_error';

export class UserEmailMismatchError extends UnauthorizedException {
  constructor() {
    super({
      code: EMAIL_MISMATCH_ERROR_CODE,
      message: 'Email does not match the registered email for this account',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}
