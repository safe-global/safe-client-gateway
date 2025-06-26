import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JobsService } from '@/datasources/jobs/jobs.service';
import { JobStatusDto, JobStatusErrorDto, JobStatusResponseDto } from '@/routes/jobs/entities/job-status.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @ApiOperation({
    summary: 'Get job status by ID',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Job status retrieved successfully',
    type: JobStatusDto,
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Job not found',
    type: JobStatusErrorDto,
  })
  @Get(':id/status')
  async getJobStatus(@Param('id') jobId: string): Promise<JobStatusResponseDto> {
    const job = await this.jobsService.getJobStatus(jobId);
    
    if (!job) {
      return { error: 'Job not found' };
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data as Record<string, unknown>,
      progress: job.progress as number | string | Record<string, unknown> | boolean | undefined,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
    };
  }
}