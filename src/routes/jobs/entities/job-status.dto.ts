import { ApiProperty } from '@nestjs/swagger';

export class JobStatusDto {
  @ApiProperty({ description: 'Job ID', example: 'job-123' })
  id?: string;

  @ApiProperty({ description: 'Job name/type', example: 'hello-world' })
  name?: string;

  @ApiProperty({ 
    description: 'Job data payload', 
    example: { message: 'Hello World', timestamp: 1640995200000 } 
  })
  data?: Record<string, unknown>;

  @ApiProperty({ 
    description: 'Job progress (can be number, string, object, or boolean)', 
    example: 50,
    oneOf: [
      { type: 'number', example: 50 },
      { type: 'string', example: '50%' },
      { type: 'object', example: { current: 5, total: 10 } },
      { type: 'boolean', example: false },
    ]
  })
  progress?: number | string | Record<string, unknown> | boolean;

  @ApiProperty({ 
    description: 'Timestamp when job processing started', 
    example: 1640995200000 
  })
  processedOn?: number;

  @ApiProperty({ 
    description: 'Timestamp when job finished', 
    example: 1640995260000 
  })
  finishedOn?: number;

  @ApiProperty({ 
    description: 'Reason for job failure', 
    example: 'Connection timeout' 
  })
  failedReason?: string;

  @ApiProperty({ 
    description: 'Job return value', 
    example: 'Job completed successfully' 
  })
  returnvalue?: unknown;
}

export class JobStatusErrorDto {
  @ApiProperty({ description: 'Error message', example: 'Job not found' })
  error!: string;
}

export type JobStatusResponseDto = JobStatusDto | JobStatusErrorDto;