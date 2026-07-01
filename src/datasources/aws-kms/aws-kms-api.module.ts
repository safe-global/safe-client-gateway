// SPDX-License-Identifier: FSL-1.1-MIT

import { Module } from '@nestjs/common';
import { AwsKmsApiService } from '@/datasources/aws-kms/aws-kms-api.service';
import { IKmsApi } from '@/domain/interfaces/kms-api.interface';

@Module({
  providers: [{ provide: IKmsApi, useClass: AwsKmsApiService }],
  exports: [IKmsApi],
})
export class AwsKmsApiModule {}
