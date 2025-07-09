export enum JobType {
  CSV_EXPORT = 'csv-export',
}

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export interface JobData {
  [JobType.CSV_EXPORT]: {
    message: string;
    timestamp: number;
  };
}
