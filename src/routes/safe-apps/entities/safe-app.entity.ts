import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SafeAppAccessControl } from './safe-app-access-control.entity';
import { SafeAppProvider } from './safe-app-provider.entity';

export class SafeApp {
  @ApiProperty()
  id: number;
  @ApiProperty()
  url: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  iconUrl: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  chainIds: string[];
  @ApiProperty()
  accessControl: SafeAppAccessControl;
  @ApiProperty()
  tags: string[];
  @ApiPropertyOptional()
  provider?: SafeAppProvider;

  constructor(
    id: number,
    url: string,
    name: string,
    iconUrl: string,
    description: string,
    chainIds: string[],
    accessControl: SafeAppAccessControl,
    tags: string[],
    provider?: SafeAppProvider,
  ) {
    this.id = id;
    this.url = url;
    this.name = name;
    this.iconUrl = iconUrl;
    this.description = description;
    this.chainIds = chainIds;
    this.accessControl = accessControl;
    this.tags = tags;
    this.provider = provider;
  }
}
