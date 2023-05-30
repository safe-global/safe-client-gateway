import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SafeAppAccessControl as DomainSafeAppAccessControl } from '../../../domain/safe-apps/entities/safe-app-access-control.entity';

export class SafeAppAccessControl implements DomainSafeAppAccessControl {
  @ApiProperty()
  type: string;
  @ApiPropertyOptional({ type: String, isArray: true, nullable: true })
  value: string[] | null;
}
