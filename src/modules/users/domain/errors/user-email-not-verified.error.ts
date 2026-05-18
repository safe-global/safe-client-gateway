// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, UnauthorizedException } from '@nestjs/common';

export const EMAIL_NOT_VERIFIED_ERROR_CODE = 'email_not_verified_error';

export class UserEmailNotVerifiedError extends UnauthorizedException {
  constructor() {
    super({
      code: EMAIL_NOT_VERIFIED_ERROR_CODE,
      message: 'Email must be verified to sign in',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}
