import { AddressInfo } from '../../common/entities/address-info.entity';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';
import { TransactionInfo } from './multisig-transaction.entity';

export interface SetFallbackHandler {
  type: string;
  handler: AddressInfo;
}

export interface AddOwner {
  type: string;
  owner: AddressInfo;
  threshold: number;
}

export interface RemoveOwner {
  type: string;
  owner: AddressInfo;
  threshold: number;
}

export interface SwapOwner {
  type: string;
  oldOwner: AddressInfo;
  newOwner: AddressInfo;
}

export interface ChangeThreshold {
  type: string;
  threshold: number;
}

export interface ChangeImplementation {
  type: string;
  implementation: AddressInfo;
}

export interface EnableModule {
  type: string;
  module: AddressInfo;
}

export interface DisableModule {
  type: string;
  module: AddressInfo;
}

export interface SetGuard {
  type: string;
  guard: AddressInfo;
}

export interface DeleteGuard {
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
  dataDecoded: DataDecoded;
  settingsInfo: SettingsInfo | undefined;
}
