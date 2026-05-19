// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, UnauthorizedException } from '@nestjs/common';

export const EMAIL_REQUIRED_ERROR_CODE = 'email_required_error';

export class UserEmailRequiredError extends UnauthorizedException {
  constructor() {
    super({
      code: EMAIL_REQUIRED_ERROR_CODE,
      message: 'A verified email is required to sign in',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}
