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

  /**
   * Gets the schema associated with {@link keyRef}.
   *
   * If the schema does not exist, the {@link schema} is compiled and added
   * to the AJV instance cache
   *
   * @param keyRef - the key associated to the schema
   * @param schema - the schema object to be added if it does not exist already
   */
  getSchema<T>(
    keyRef: string,
    schema: Schema | JSONSchemaType<T>,
  ): ValidateFunction<T> {
    return this.ajv.getSchema(keyRef) || this.ajv.compile(schema);
  }
}
