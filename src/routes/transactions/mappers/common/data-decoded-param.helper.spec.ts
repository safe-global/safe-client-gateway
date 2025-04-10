import { faker } from '@faker-js/faker';
import {
  DataDecodedAccuracy,
  type DataDecoded,
  type DataDecodedParameter,
} from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { getAddress } from 'viem';

describe('DataDecoded param helper (Unit)', () => {
  const helper = new DataDecodedParamHelper();

  describe('getFromParam', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: null,
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 0,
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transfer method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'value',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transfer',
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "from" param for a transferFrom method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'value',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('value');
    });

    it('should get the DataDecoded "from" param for a safeTransferFrom method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'value',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'safeTransferFrom',
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('value');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'value',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getFromParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('getToParam', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: null,
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 0,
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transfer method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'secondValue',
        valueDecoded: null,
      };

      const dataDecoded: DataDecoded = {
        method: 'transfer',
        parameters: [firstParam, secondParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('firstValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: faker.number.int(),
        valueDecoded: null,
      };
      const dataDecoded = {
        method: 'transfer',
        parameters: [firstParam, [firstParam]],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
        // We cast as it is invalid DataDecoded
      } as DataDecoded;

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "to" param for a transferFrom method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'secondValue',
        valueDecoded: null,
      };

      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam, secondParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded "to" param for a safeTransferFrom method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'secondValue',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam, secondParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'value',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getToParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('getValueParam', () => {
    it('should return the fallback value if null parameters in DataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: null,
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if empty parameters in DataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should return the fallback value if non-string parameters in DataDecoded', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: faker.number.int(),
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transfer method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'secondValue',
        valueDecoded: null,
      };

      const dataDecoded: DataDecoded = {
        method: 'transfer',
        parameters: [firstParam, secondParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('secondValue');
    });

    it('should get the DataDecoded fallback for a non-string param', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: faker.number.int(),
        valueDecoded: null,
      };

      const dataDecoded: DataDecoded = {
        method: 'transfer',
        parameters: [firstParam, secondParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });

    it('should get the DataDecoded "value" param for a transferFrom method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'secondValue',
        valueDecoded: null,
      };
      const thirdParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'thirdValue',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam, secondParam, thirdParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('thirdValue');
    });

    it('should get the DataDecoded "value" param for a safeTransferFrom method', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'firstValue',
        valueDecoded: null,
      };
      const secondParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'secondValue',
        valueDecoded: null,
      };
      const thirdParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'thirdValue',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: 'transferFrom',
        parameters: [firstParam, secondParam, thirdParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('thirdValue');
    });

    it('should return the fallback value if method is not "transferFrom"', () => {
      const firstParam: DataDecodedParameter = {
        name: faker.word.sample(),
        type: faker.word.sample(),
        value: 'value',
        valueDecoded: null,
      };
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [firstParam],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      const fromParam = helper.getValueParam(dataDecoded, 'fallback');

      expect(fromParam).toBe('fallback');
    });
  });

  describe('hasNestedDelegate', () => {
    it('should return false if the nested data decoded only contains a CALL operation', () => {
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [
          {
            name: faker.word.sample(),
            type: faker.word.sample(),
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: {
                  method: faker.word.sample(),
                  parameters: [
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.string.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(false);
    });

    it('should return false if the nested data decoded only contains several CALL operations', () => {
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [
          {
            name: faker.word.sample(),
            type: faker.word.sample(),
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: {
                  method: faker.word.sample(),
                  parameters: [
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.string.numeric(),
                    },
                  ],
                },
              },
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: {
                  method: faker.word.sample(),
                  parameters: [
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.string.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(false);
    });

    it('should return false if the nested data decoded does not have parameters', () => {
      const dataDecoded = {
        method: faker.word.sample(),
        // We cast as it is invalid DataDecoded
      } as DataDecoded;

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(false);
    });

    it('should return true if there is one nested DELEGATE operation', () => {
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [
          {
            name: faker.word.sample(),
            type: faker.word.sample(),
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [
              {
                operation: 1,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: {
                  method: faker.word.sample(),
                  parameters: [
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.string.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(true);
    });

    it('should return true if there is just one nested DELEGATE operation', () => {
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [
          {
            name: faker.word.sample(),
            type: faker.word.sample(),
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [
              {
                operation: 1,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: {
                  method: faker.word.sample(),
                  parameters: [
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.string.numeric(),
                    },
                  ],
                },
              },
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: {
                  method: faker.word.sample(),
                  parameters: [
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.finance.ethereumAddress(),
                    },
                    {
                      name: faker.word.sample(),
                      type: faker.word.sample(),
                      value: faker.string.numeric(),
                    },
                  ],
                },
              },
            ],
          },
        ],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(true);
    });

    it('should return true if there is one nested DELEGATE operation with no inner dataDecoded', () => {
      const dataDecoded: DataDecoded = {
        method: faker.word.sample(),
        parameters: [
          {
            name: faker.word.sample(),
            type: faker.word.sample(),
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [
              {
                operation: 1,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: null,
              },
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
                value: faker.string.numeric(),
                data: faker.string.hexadecimal({ length: 32 }) as `0x${string}`,
                dataDecoded: null,
              },
            ],
          },
        ],
        accuracy: faker.helpers.arrayElement(DataDecodedAccuracy),
      };

      expect(helper.hasNestedDelegate(dataDecoded)).toBe(true);
    });
  });
});
