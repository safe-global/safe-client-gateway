// SPDX-License-Identifier: FSL-1.1-MIT
import { NotImplementedException } from '@nestjs/common';
import type { RelayerType } from '@/modules/relay/domain/entities/relayer-type.entity';

export class RelayerTypeNotImplementedError extends NotImplementedException {
  constructor(readonly relayerType: RelayerType) {
    super(`Relayer type ${relayerType} not implemented`);
  }
}
