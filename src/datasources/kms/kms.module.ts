// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { KmsService } from '@/datasources/kms/kms.service';

@Module({
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}
