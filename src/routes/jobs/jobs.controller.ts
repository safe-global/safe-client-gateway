import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { JobsService } from '@/routes/jobs/jobs.service';
import {
  JobStatusDto,
  JobStatusErrorDto,
  JobStatusResponseDto,
} from '@/routes/jobs/entities/job-status.dto';

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
  public async getJobStatus(
    @Param('id') jobId: string,
  ): Promise<JobStatusResponseDto> {
    return this.jobsService.getJobStatus(jobId);
  }
}
