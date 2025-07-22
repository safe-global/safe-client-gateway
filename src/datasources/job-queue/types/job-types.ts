export enum JobType {
  TEST_JOB = 'test-job', // for testing purposes
}

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export interface JobData {
  timestamp: number;
}
