// SPDX-License-Identifier: FSL-1.1-MIT
import { UnprocessableEntityException } from '@nestjs/common';

export class UnofficialSignerFactoryError extends UnprocessableEntityException {
  constructor() {
    super(
      'SafeWebAuthnSignerFactory contract is not official. Only official SafeWebAuthnSignerFactory contracts are supported.',
    );
  }
}
