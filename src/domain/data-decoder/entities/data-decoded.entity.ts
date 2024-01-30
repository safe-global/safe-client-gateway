export interface DataDecodedParameter {
  name: string;
  type: string;
  value: unknown;
  valueDecoded?: Record<string, unknown> | Record<string, unknown>[];
}

export interface DataDecoded {
  method: string;
  parameters: DataDecodedParameter[] | null;
}
