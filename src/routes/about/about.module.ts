import { Module } from '@nestjs/common';
import { AboutController } from '@/routes/about/about.controller';
import { AboutService } from '@/routes/about/about.service';

@Module({
  controllers: [AboutController],
  providers: [AboutService],
})
export class AboutModule {}
