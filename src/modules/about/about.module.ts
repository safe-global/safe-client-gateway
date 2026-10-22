// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { AboutController } from '#/modules/about/routes/about.controller';
import { AboutService } from '#/modules/about/routes/about.service';

@Module({
  controllers: [AboutController],
  providers: [AboutService],
})
export class AboutModule {}
