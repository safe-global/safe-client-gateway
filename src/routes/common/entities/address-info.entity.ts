import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressInfo {
  @ApiProperty()
  readonly value: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly name: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  readonly logoUri: string | null;

  constructor(
    value: string,
    name?: string,
    // TODO: Change to `string | null` when possible to match schema types
    // https://github.com/safe-global/safe-client-gateway/blob/c032b43720cef3d316cc80ba439c36fb1b6fb9ea/src/routes/common/address-info/address-info.helper.ts#L105
    logoUri?: string,
  ) {
    this.value = value;
    this.name = name || null;
    this.logoUri = logoUri || null;
  }
}
