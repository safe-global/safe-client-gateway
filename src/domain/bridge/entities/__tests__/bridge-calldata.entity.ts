import { Builder } from '@/__tests__/builder';
import type { IBuilder } from '@/__tests__/builder';
import type { BridgeCalldata } from '@/domain/bridge/entities/bridge-calldata.entity';

export function bridgeCalldataBuilder(): IBuilder<BridgeCalldata> {
  // TODO: Populate with BridgeCalldata
  return new Builder<BridgeCalldata>();
}
