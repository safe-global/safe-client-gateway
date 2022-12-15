import { faker } from '@faker-js/faker';
import { DataDecoded } from '../../../../data-decode/entities/data-decoded.entity';
import { DataDecodedParamHelper } from './data-decoded-param.helper';

describe('DataDecoded param helper (Unit)', () => {
  const helper = new DataDecodedParamHelper();

  describe('getFromParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = new DataDecoded('transferFrom', null);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = new DataDecoded('transferFrom', []);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 0,
      };
      const dataDecoded = new DataDecoded('transferFrom', [firstParam]);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transfer method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = new DataDecoded('transfer', [firstParam]);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transferFrom method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = new DataDecoded('transferFrom', [firstParam]);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('value');
    });

    it('should get the DataDecoded "from" param for a safeTransferFrom method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = new DataDecoded('safeTransferFrom', [firstParam]);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('value');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = new DataDecoded(faker.random.word(), [firstParam]);
      const fromParam = helper.getFromParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });
  });

  describe('getToParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = new DataDecoded('transferFrom', null);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = new DataDecoded('transferFrom', []);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 0,
      };
      const dataDecoded = new DataDecoded('transferFrom', [firstParam]);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transfer method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'secondValue',
      };
      const dataDecoded = new DataDecoded('transfer', [
        firstParam,
        secondParam,
      ]);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('firstValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = new DataDecoded('transfer', [firstParam]);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transferFrom method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'secondValue',
      };
      const dataDecoded = new DataDecoded('transferFrom', [
        firstParam,
        secondParam,
      ]);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded "to" param for a safeTransferFrom method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'secondValue',
      };
      const dataDecoded = new DataDecoded('transferFrom', [
        firstParam,
        secondParam,
      ]);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('secondValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = new DataDecoded(faker.random.word(), [firstParam]);
      const fromParam = helper.getToParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });
  });

  describe('getValueParam function tests', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded = new DataDecoded('transferFrom', null);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded = new DataDecoded('transferFrom', []);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = new DataDecoded('transferFrom', [firstParam]);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transfer method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'secondValue',
      };
      const dataDecoded = new DataDecoded('transfer', [
        firstParam,
        secondParam,
      ]);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: faker.datatype.number(),
      };
      const dataDecoded = new DataDecoded('transfer', [
        firstParam,
        secondParam,
      ]);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transferFrom method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'secondValue',
      };
      const thirdParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'thirdValue',
      };
      const dataDecoded = new DataDecoded('transferFrom', [
        firstParam,
        secondParam,
        thirdParam,
      ]);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('thirdValue');
    });

    it('should get the DataDecoded "value" param for a safeTransferFrom method', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'firstValue',
      };
      const secondParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'secondValue',
      };
      const thirdParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'thirdValue',
      };
      const dataDecoded = new DataDecoded('transferFrom', [
        firstParam,
        secondParam,
        thirdParam,
      ]);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('thirdValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam = {
        name: faker.random.word(),
        paramType: faker.random.word(),
        value: 'value',
      };
      const dataDecoded = new DataDecoded(faker.random.word(), [firstParam]);
      const fromParam = helper.getValueParam(dataDecoded, 'fallback');
      expect(fromParam).toBe('fallback');
    });
  });
});
