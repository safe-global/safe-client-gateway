import Ajv, { Schema, ValidateFunction } from 'ajv';
import { addIsDate } from './is-date.keyword';
import { faker } from '@faker-js/faker';

describe('AJV Keyword – isDate', () => {
  let ajv: Ajv;

  beforeEach(() => {
    ajv = new Ajv();
    addIsDate(ajv);
  });

  describe('isDate is true', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        date: { type: 'string', isDate: true, nullable: true },
      },
    };

    let validateFunction: ValidateFunction;

    beforeEach(() => {
      validateFunction = ajv.compile(schema);
    });

    it('not valid if date is empty string', async () => {
      const actual = validateFunction({
        date: '',
      });

      expect(actual).toBe(false);
    });

    it('valid if date is ISO-8601', async () => {
      const actual = validateFunction({
        date: faker.date.past().toISOString(),
      });

      expect(actual).toBe(true);
    });

    it('valid if date is null', async () => {
      const actual = validateFunction({
        date: null,
      });

      expect(actual).toBe(true);
    });
  });

  describe('isDate is false', () => {
    const schema: Schema = {
      type: 'object',
      properties: {
        date: { type: 'string', isDate: false, nullable: true },
      },
    };

    let validateFunction: ValidateFunction;

    beforeEach(() => {
      validateFunction = ajv.compile(schema);
    });

    it('valid if date is empty string', async () => {
      const actual = validateFunction({
        date: '',
      });

      expect(actual).toBe(true);
    });

    it('valid on random string', async () => {
      const actual = validateFunction({
        date: faker.datatype.string(),
      });

      expect(actual).toBe(true);
    });

    it('valid if date is null', async () => {
      const actual = validateFunction({
        date: null,
      });

      expect(actual).toBe(true);
    });
  });
});
