import { faker } from '@faker-js/faker';
import { DataDecodedParamHelper } from './data-decoded-param.helper';
import {
  DataDecoded,
  DataDecodedParameter,
} from '../../../../domain/data-decoder/entities/data-decoded.entity';

describe('DataDecoded param helper (Unit)', () => {
  const helper = new DataDecodedParamHelper();

  describe('getFromParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: null,
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 0,
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transfer method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('value');
    });

    it('should get the DataDecoded "from" param for a safeTransferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: 'safeTransferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('value');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [firstParam],
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('getToParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: null,
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 0,
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transfer method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };

      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('firstValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, [firstParam]],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };

      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded "to" param for a safeTransferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [firstParam],
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('getValueParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: null,
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transfer method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };

      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam = {
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        type: faker.random.word(),
        value: faker.datatype.number(),
      };

      const dataDecoded = <DataDecoded>{
        method: 'transfer',
        parameters: [firstParam, secondParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };
      const thirdParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'thirdValue',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam, thirdParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('thirdValue');
    });

    it('should get the DataDecoded "value" param for a safeTransferFrom method', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'secondValue',
      };
      const thirdParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'thirdValue',
      };
      const dataDecoded = <DataDecoded>{
        method: 'transferFrom',
        parameters: [firstParam, secondParam, thirdParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('thirdValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = <DataDecodedParameter>{
        name: faker.random.word(),
        type: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = <DataDecoded>{
        method: faker.random.word(),
        parameters: [firstParam],
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });
});
