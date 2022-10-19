export interface DataDecodedParameter {
  name: string;
  type: string;
  value: string | number;
  valueDecoded?: Record<string, any> | Record<string, any>[];
}

export interface DataDecoded {
  method: string;
  parameters?: DataDecodedParameter[];
}
