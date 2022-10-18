import { Injectable } from '@nestjs/common';
import Ajv, { JSONSchemaType, Schema, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

@Injectable()
export class JsonSchemaService {
  private readonly ajv: Ajv;

  constructor() {
    // coerceTypes param shouldn't be necessary when serialization is implemented.
    this.ajv = new Ajv({ coerceTypes: true, useDefaults: true });
    addFormats(this.ajv, { formats: ['uri'] });
  }

  addSchema<T>(schema: Schema | JSONSchemaType<T>, name: string): void {
    this.ajv.addSchema(schema, name);
  }

  compile<T>(schema: Schema | JSONSchemaType<T>): ValidateFunction<T> {
    return this.ajv.compile(schema);
  }
}
