export enum JobType {
  HELLO_WORLD = 'hello-world',
}

export interface JobData {
  [JobType.HELLO_WORLD]: {
    message: string;
    timestamp: number;
  };
}