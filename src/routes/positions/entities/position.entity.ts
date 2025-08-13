import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import {
  NativeToken,
  Erc20Token,
  Erc721Token,
} from '@/routes/balances/entities/token.entity';
import { PositionType } from '@/domain/positions/entities/position-type.entity';

@ApiExtraModels(NativeToken, Erc20Token, Erc721Token)
export class Position {
  @ApiProperty()
  balance!: string;
  @ApiProperty()
  fiatBalance!: string;
  @ApiProperty()
  fiatConversion!: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(NativeToken) },
      { $ref: getSchemaPath(Erc20Token) },
      { $ref: getSchemaPath(Erc721Token) },
    ],
  })
  tokenInfo!: NativeToken | Erc20Token | Erc721Token;
  @ApiProperty({ type: String, nullable: true })
  fiatBalance24hChange!: string | null;
  @ApiProperty({ enum: PositionType, nullable: true })
  position_type!: PositionType;
}
