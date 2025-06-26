import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobsService } from '@/datasources/jobs/jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @ApiOperation({
    summary: 'Get job status by ID',
  })
  @Get(':id/status')
  async getJobStatus(@Param('id') jobId: string): Promise<{
    id?: string;
    name?: string;
    data?: unknown;
    progress?: unknown;
    processedOn?: number;
    finishedOn?: number;
    failedReason?: string;
    returnvalue?: unknown;
    error?: string;
  }> {
    const job = await this.jobsService.getJobStatus(jobId);
    
    if (!job) {
      return { error: 'Job not found' };
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }
}