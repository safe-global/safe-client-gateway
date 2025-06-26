export const JobType = {
  HELLO_WORLD: 'hello-world',
} as const;

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

export interface JobData {
  [JobType.HELLO_WORLD]: {
    message: string;
    timestamp: number;
  };
}
