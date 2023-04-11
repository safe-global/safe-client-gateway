import { ApiExtraModels, ApiProperty } from '@nestjs/swagger';
import { Operation } from '../../../domain/safe/entities/operation.entity';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';

@ApiExtraModels(AddressInfo, DataDecoded)
export class TransactionData {
  @ApiProperty()
  hexData: string;
  @ApiProperty()
  dataDecoded: DataDecoded;
  @ApiProperty()
  to: AddressInfo;
  @ApiProperty()
  value: string;
  @ApiProperty()
  operation: Operation;
  @ApiProperty()
  isTrustedDelegateCall: boolean | null;
  @ApiProperty()
  addressInfoIndex: Record<string, AddressInfo> | null;

  constructor(
    hexData: string,
    dataDecoded: DataDecoded,
    to: AddressInfo,
    value: string,
    operation: Operation,
    isTrustedDelegateCall: boolean | null,
    addressInfoIndex: Record<string, AddressInfo> | null,
  ) {
    this.hexData = hexData;
    this.dataDecoded = dataDecoded;
    this.to = to;
    this.value = value;
    this.operation = operation;
    this.isTrustedDelegateCall = isTrustedDelegateCall;
    this.addressInfoIndex = addressInfoIndex;
  }
}
