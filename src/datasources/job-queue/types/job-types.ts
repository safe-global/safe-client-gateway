export enum JobType {
  TEST_JOB = 'test-job', // for testing purposes
  CSV_EXPORT = 'csv-export',
}

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export interface JobData {
  timestamp?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JobResponse {}
