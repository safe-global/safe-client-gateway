export const JobType = {} as const;

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JobData {}
