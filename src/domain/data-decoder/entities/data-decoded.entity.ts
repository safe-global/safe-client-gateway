export interface DataDecodedParameter {
  name: string;
  param_type: string;
  value: string | number;
  value_decoded?: Record<string, any>;
}

export interface DataDecoded {
  method: string;
  parameters?: DataDecodedParameter[];
}
