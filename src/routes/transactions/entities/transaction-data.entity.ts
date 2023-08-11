import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { Operation } from '../../../domain/safe/entities/operation.entity';
import { AddressInfo } from '../../common/entities/address-info.entity';
import { DataDecoded } from '../../data-decode/entities/data-decoded.entity';

@ApiExtraModels(AddressInfo, DataDecoded)
export class TransactionData {
  @ApiPropertyOptional({ type: String, nullable: true })
  hexData: string | null;
  @ApiPropertyOptional({ type: DataDecoded, nullable: true })
  dataDecoded: DataDecoded | null;
  @ApiProperty()
  to: AddressInfo;
  @ApiPropertyOptional({ type: String, nullable: true })
  value: string | null;
  @ApiProperty()
  operation: Operation;
  @ApiPropertyOptional({ type: Boolean, nullable: true })
  trustedDelegateCallTarget: boolean | null;
  @ApiPropertyOptional({ type: Object, nullable: true })
  addressInfoIndex: Record<string, AddressInfo> | null;

  constructor(
    hexData: string | null,
    dataDecoded: DataDecoded | null,
    to: AddressInfo,
    value: string,
    operation: Operation,
    trustedDelegateCallTarget: boolean | null,
    addressInfoIndex: Record<string, AddressInfo> | null,
  ) {
    this.hexData = hexData;
    this.dataDecoded = dataDecoded;
    this.to = to;
    this.value = value;
    this.operation = operation;
    this.trustedDelegateCallTarget = trustedDelegateCallTarget;
    this.addressInfoIndex = addressInfoIndex;
  }
}
