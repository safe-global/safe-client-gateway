import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RichFragmentType {
  Text = 'text',
  TokenValue = 'tokenValue',
  Address = 'address',
}

export abstract class RichDecodedInfoFragment {
  @ApiProperty()
  type: RichFragmentType;
  @ApiProperty()
  value: string;

  protected constructor(type: RichFragmentType, value: string) {
    this.type = type;
    this.value = value;
  }
}

export class RichTokenValueFragment extends RichDecodedInfoFragment {
  @ApiPropertyOptional({ type: String, nullable: true })
  symbol: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  logoUri: string | null;

  constructor(value: string, symbol: string | null, logoUri: string | null) {
    super(RichFragmentType.TokenValue, value);
    this.value = value;
    this.symbol = symbol;
    this.logoUri = logoUri;
  }
}

export class RichTextFragment extends RichDecodedInfoFragment {
  constructor(value: string) {
    super(RichFragmentType.Text, value);
  }
}

export class RichAddressFragment extends RichDecodedInfoFragment {
  constructor(value: `0x${string}`) {
    super(RichFragmentType.Address, value);
  }
}

export type RichDecodedInfo = {
  fragments: RichDecodedInfoFragment[];
};
