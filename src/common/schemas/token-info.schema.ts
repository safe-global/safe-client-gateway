import { JSONSchemaType } from "ajv";
import { TokenInfo } from "../entities/token-info.entity";
import { TokenType } from "../entities/token-type.entity";

const tokenInfoSchema: JSONSchemaType<TokenInfo> = {
  type: 'object',
  properties: {
    tokenType: {
      type: 'string',
      enum: [
        TokenType.Erc20,
        TokenType.Erc721,
        TokenType.NativeToken,
        TokenType.Unknown,
      ],
    },
    address: { type: 'string' },
    decimals: { type: 'number' },
    symbol: { type: 'string' },
    name: { type: 'string' },
    logoUri: { type: 'string', nullable: true },
  },
  required: [],
};

export { tokenInfoSchema };
