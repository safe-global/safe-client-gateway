import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VaultInfo {
  @ApiProperty()
  address: `0x${string}`;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  dashboardUri: string | null;

  @ApiProperty()
  logoUri: string;

  constructor(args: {
    address: `0x${string}`;
    name: string;
    description: string;
    dashboardUri: string | null;
    logoUri: string;
  }) {
    this.address = args.address;
    this.name = args.name;
    this.description = args.description;
    this.dashboardUri = args.dashboardUri;
    this.logoUri = args.logoUri;
  }
}
