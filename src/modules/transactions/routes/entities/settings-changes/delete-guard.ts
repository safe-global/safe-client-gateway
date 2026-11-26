// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SettingsChange,
  SettingsChangeType,
} from '#/modules/transactions/routes/entities/settings-changes/settings-change.entity';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

export class DeleteGuard extends SettingsChange {
  @ApiProperty({ enum: [SettingsChangeType.DeleteGuard] })
  declare type: SettingsChangeType.DeleteGuard;

  @ApiPropertyOptional({
    type: AddressInfo,
    nullable: true,
    description:
      'The current guard of the Safe while the transaction is queued, otherwise null',
  })
  guard: AddressInfo | null;

  constructor(guard: AddressInfo | null) {
    super(SettingsChangeType.DeleteGuard);
    this.guard = guard;
  }
}
