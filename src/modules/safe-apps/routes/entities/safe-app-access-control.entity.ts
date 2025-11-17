import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SafeAppAccessControl as DomainSafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '@/modules/safe-apps/domain/entities/safe-app-access-control.entity';

export class SafeAppAccessControl implements DomainSafeAppAccessControl {
  @ApiProperty()
  type!: SafeAppAccessControlPolicies;
  @ApiPropertyOptional({ type: String, isArray: true, nullable: true })
  value!: Array<string> | null;
}
