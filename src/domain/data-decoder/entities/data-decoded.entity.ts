export interface DataDecodedParameter {
  name: string;
  type: string;
  value: unknown;
  valueDecoded?: Record<string, any> | Record<string, any>[];
}

export interface DataDecoded {
  method: string;
  parameters: DataDecodedParameter[] | null;
  readableDescription: string | null;
}
