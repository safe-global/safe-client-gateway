import { faker } from '@faker-js/faker';
import { HttpException } from '@nestjs/common';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { BackboneValidator } from './backbone.validator';

const mockValidationErrorFactory = jest.mocked({
  from: jest.fn(),
} as unknown as ValidationErrorFactory);

const validationFunction = jest.fn();
const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService);

describe('Backbone validator', () => {
  const validator = new BackboneValidator(
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const backbone = backboneFactory();
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(backbone);

    expect(result).toBe(backbone);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    const backbone = backboneFactory();
    const errMsg = faker.random.words();
    mockValidationErrorFactory.from.mockReturnValueOnce(
      new HttpException(errMsg, 500),
    );
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(backbone)).toThrow(errMsg);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
