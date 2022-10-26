import { ApiProperty } from '@nestjs/swagger';
import { SafeApp as DomainSafeApp } from '../../../domain/safe-apps/entities/safe-app.entity';
import { SafeAppAccessControl } from './safe-app-access-control.entity';
import { SafeAppProvider } from './safe-app-provider.entity';

export class SafeApp implements DomainSafeApp {
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
  chainIds: number[];
  @ApiProperty()
  provider?: SafeAppProvider;
  @ApiProperty()
  accessControl: SafeAppAccessControl;
  @ApiProperty()
  tags: string[];
}
