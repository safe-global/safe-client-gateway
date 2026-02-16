import { ApiProperty } from '@nestjs/swagger';
import { type SafeAppProvider as DomainSafeAppProvider } from '@/modules/safe-apps/domain/entities/safe-app-provider.entity';

export class SafeAppProvider implements DomainSafeAppProvider {
  @ApiProperty()
  url!: string;
  @ApiProperty()
  name!: string;
}
