export class DataDecodedParameter {
  name: string;
  param_type: string;
  value: string | number;
  value_decoded?: Record<string, any>;
}

export class DataDecoded {
  method: string;
  parameters?: DataDecodedParameter[];
}
