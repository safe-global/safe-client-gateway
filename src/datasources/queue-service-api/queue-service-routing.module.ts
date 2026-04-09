// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { QueueServiceRoutingHelper } from './queue-service-routing.helper';

@Module({
  providers: [QueueServiceRoutingHelper],
  exports: [QueueServiceRoutingHelper],
})
export class QueueServiceRoutingModule {}
