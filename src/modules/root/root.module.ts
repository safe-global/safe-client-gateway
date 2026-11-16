// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { RootController } from '#/modules/root/routes/root.controller';

@Module({
  controllers: [RootController],
})
export class RootModule {}
