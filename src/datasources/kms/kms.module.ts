// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { AwsKmsService } from '@/datasources/kms/aws-kms.service';
import { IKmsService } from '@/datasources/kms/kms.service.interface';

@Module({
  providers: [{ provide: IKmsService, useClass: AwsKmsService }],
  exports: [IKmsService],
})
export class KmsModule {}
