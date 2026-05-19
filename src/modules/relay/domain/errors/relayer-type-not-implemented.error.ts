// SPDX-License-Identifier: FSL-1.1-MIT
import { ForbiddenException } from '@nestjs/common';

export class RelayerTypeNotImplementedError extends ForbiddenException {
  constructor(readonly relayerType: string) {
    super(`Relayer type ${relayerType} not implemented`);
  }
}
