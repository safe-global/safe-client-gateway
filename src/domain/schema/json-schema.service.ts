import { Injectable } from '@nestjs/common';
import Ajv, { JSONSchemaType, Schema, ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { addIsDate } from './keywords/is-date.keyword';

@Injectable()
export class JsonSchemaService {
  private readonly ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allowUnionTypes: true,
      useDefaults: true,
      discriminator: true,
      removeAdditional: 'all',
    });

    addIsDate(this.ajv);
    addFormats(this.ajv, { formats: ['uri'] });
  }

  addSchema<T>(schema: Schema | JSONSchemaType<T>, name: string): void {
    this.ajv.addSchema(schema, name);
  }

  compile<T>(schema: Schema | JSONSchemaType<T>): ValidateFunction<T> {
    return this.ajv.compile(schema);
  }
}
