import { JobData, JobResponse } from '@/datasources/job-queue/types/job-types';
import { ApiProperty } from '@nestjs/swagger';

export class JobStatusDto {
  @ApiProperty({ description: 'Job ID' })
  id?: string;

  @ApiProperty({ description: 'Job name' })
  name?: string;

  @ApiProperty({
    description: 'Job data payload',
  })
  data?: JobData;

  @ApiProperty({
    description: 'Job progress',
    oneOf: [
      { type: 'number', example: 50 },
      { type: 'string', example: '50%' },
      { type: 'boolean', example: false },
      { type: 'object', example: { current: 5, total: 10 } },
    ],
  })
  progress?: number | string | boolean | object;

  @ApiProperty({
    description: 'Timestamp when job processing started',
  })
  processedOn?: number;

  @ApiProperty({
    description: 'Timestamp when job finished',
  })
  finishedOn?: number;

  @ApiProperty({
    description: 'Reason for job failure',
  })
  failedReason?: string;

  @ApiProperty({
    description: 'Job return value',
  })
  returnValue?: JobResponse; //TODO do even need this? maybe use Record<string, any>
}

export class JobStatusErrorDto {
  @ApiProperty({ description: 'Error message' })
  error!: string;
}

export type JobStatusResponseDto = JobStatusDto | JobStatusErrorDto;
