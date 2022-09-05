import { Injectable } from '@nestjs/common';
import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';

@Injectable()
export class JsonSchemaService {
  private readonly ajv: Ajv;

  constructor() {
    // coerceTypes param shouldn't be necessary when serialization is implemented.
    this.ajv = new Ajv({ coerceTypes: true });
  }

  addSchema<T>(schema: JSONSchemaType<T>, name: string): void {
    this.ajv.addSchema(schema, name);
  }

  compile<T>(schema: JSONSchemaType<T>): ValidateFunction {
    return this.ajv.compile(schema);
  }
}
