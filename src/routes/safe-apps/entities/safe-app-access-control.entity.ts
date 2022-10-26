import { ApiProperty } from '@nestjs/swagger';
import { SafeAppAccessControl as DomainSafeAppAccessControl } from '../../../domain/safe-apps/entities/safe-app-access-control.entity';

export class SafeAppAccessControl implements DomainSafeAppAccessControl {
  @ApiProperty()
  type: string;
}
