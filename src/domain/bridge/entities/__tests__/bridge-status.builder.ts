import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { BridgeStatus } from '@/domain/bridge/entities/bridge-status.entity';

export function bridgeStatusBuilder(): IBuilder<BridgeStatus> {
  // TODO: Populate with BridgeStatus
  return new Builder<BridgeStatus>();
}
