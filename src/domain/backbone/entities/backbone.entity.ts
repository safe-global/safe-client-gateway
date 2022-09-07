export interface Backbone {
  name: string;
  version: string;
  api_version: string;
  secure: boolean;
  host: string;
  headers: string[];
  // TODO: use Record<string, string>, define a compatible JSONSchema
  settings: object;
}
