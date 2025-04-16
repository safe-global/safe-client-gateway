import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import {
  Erc20Token,
  Erc721Token,
  NativeToken,
} from '@/routes/balances/entities/token.entity';

@ApiExtraModels(AddressInfo, DataDecoded, Erc20Token, Erc721Token, NativeToken)
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
  @ApiPropertyOptional({
    type: Object,
    additionalProperties: {
      $ref: getSchemaPath(AddressInfo),
    },
    nullable: true,
  })
  addressInfoIndex: Record<string, AddressInfo> | null;
  @ApiPropertyOptional({
    type: Object,
    additionalProperties: {
      oneOf: [
        { $ref: getSchemaPath(NativeToken) },
        { $ref: getSchemaPath(Erc20Token) },
        { $ref: getSchemaPath(Erc721Token) },
      ],
    },
    nullable: true,
  })
  tokenInfoIndex: Record<
    `0x${string}`,
    Erc20Token | Erc721Token | NativeToken
  > | null;

  constructor(
    hexData: string | null,
    dataDecoded: DataDecoded | null,
    to: AddressInfo,
    value: string | null,
    operation: Operation,
    trustedDelegateCallTarget: boolean | null,
    addressInfoIndex: Record<string, AddressInfo> | null,
    tokenInfoIndex: Record<
      `0x${string}`,
      Erc20Token | Erc721Token | NativeToken
    > | null,
  ) {
    this.hexData = hexData;
    this.dataDecoded = dataDecoded;
    this.to = to;
    this.value = value;
    this.operation = operation;
    this.trustedDelegateCallTarget = trustedDelegateCallTarget;
    this.addressInfoIndex = addressInfoIndex;
    this.tokenInfoIndex = tokenInfoIndex;
  }
}
