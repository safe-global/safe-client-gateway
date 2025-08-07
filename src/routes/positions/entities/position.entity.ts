import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  NativeToken,
  Erc20Token,
  Erc721Token,
} from '@/routes/balances/entities/token.entity';

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
  @ApiPropertyOptional({ type: String, nullable: true })
  fiatBalance24hChange!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  protocol!: string | null;
  @ApiProperty()
  name!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  position_type!: string | null;
}
