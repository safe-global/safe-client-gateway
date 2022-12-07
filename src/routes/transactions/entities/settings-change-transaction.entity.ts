import { ApiProperty } from '@nestjs/swagger';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';
import { TransactionInfo } from './multisig-transaction.entity';

export class SetFallbackHandler {
  @ApiProperty()
  type: string;
  @ApiProperty()
  handler: AddressInfo;
}

export class AddOwner {
  @ApiProperty()
  type: string;
  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  threshold: number;
}

export class RemoveOwner {
  @ApiProperty()
  type: string;
  @ApiProperty()
  owner: AddressInfo;
  @ApiProperty()
  threshold: number;
}

export class SwapOwner {
  @ApiProperty()
  type: string;
  @ApiProperty()
  oldOwner: AddressInfo;
  @ApiProperty()
  newOwner: AddressInfo;
}

export class ChangeThreshold {
  @ApiProperty()
  type: string;
  @ApiProperty()
  threshold: number;
}

export class ChangeImplementation {
  @ApiProperty()
  type: string;
  @ApiProperty()
  implementation: AddressInfo;
}

export class EnableModule {
  @ApiProperty()
  type: string;
  @ApiProperty()
  module: AddressInfo;
}

export class DisableModule {
  @ApiProperty()
  type: string;
  @ApiProperty()
  module: AddressInfo;
}

export class SetGuard {
  @ApiProperty()
  type: string;
  @ApiProperty()
  guard: AddressInfo;
}

export class DeleteGuard {
  @ApiProperty()
  type: string;
}

export type SettingsInfo =
  | SetFallbackHandler
  | AddOwner
  | RemoveOwner
  | SwapOwner
  | ChangeThreshold
  | ChangeImplementation
  | EnableModule
  | DisableModule
  | SetGuard
  | DeleteGuard;

export class SettingsChangeTransactionInfo extends TransactionInfo {
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiProperty()
  settingsInfo: SettingsInfo | undefined;
}
