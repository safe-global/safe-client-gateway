export enum JobType {
  TEST_JOB = 'test-job', // for testing purposes
  CSV_EXPORT = 'csv-export',
}

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export interface JobData {
  timestamp: number;
}
