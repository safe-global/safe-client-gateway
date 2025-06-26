import { Module } from '@nestjs/common';
import { JobsController } from '@/routes/jobs/jobs.controller';

@Module({
  controllers: [JobsController],
})
export class JobsRouteModule {}
