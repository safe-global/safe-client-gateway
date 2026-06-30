// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException } from '@nestjs/common';

export class NoRelayerDefinedError extends ForbiddenException {
  constructor() {
    super('No relayer defined');
  }
}
