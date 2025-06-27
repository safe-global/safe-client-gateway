import { Module } from '@nestjs/common';
import { JobsController } from '@/routes/jobs/jobs.controller';
import { JobsService } from '@/routes/jobs/jobs.service';
import { JobsRepositoryModule } from '@/domain/jobs/jobs.repository.interface';

@Module({
  imports: [JobsRepositoryModule],
  controllers: [JobsController],
  providers: [JobsService],
})
export class JobsRouteModule {}
