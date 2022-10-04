import { HttpException } from '@nestjs/common';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { JsonSchemaService } from '../schema/json-schema.service';
import { ValidationErrorFactory } from '../schema/validation-error-factory';
import { BackboneValidator } from './backbone.validator';

const expectedErrMessage = 'testErrMessage';

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

  const backbone = backboneFactory();

  it('should return the data when validation succeed', () => {
    mockValidationErrorFactory.from.mockReturnValue(
      new HttpException(expectedErrMessage, 500),
    );
    validationFunction.mockImplementationOnce(() => true);

    const result = validator.validate(backbone);

    expect(result).toBe(backbone);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(0);
  });

  it('should throw a validation error when validation fails', async () => {
    validationFunction.mockImplementationOnce(() => false);

    expect(() => validator.validate(backbone)).toThrow(expectedErrMessage);
    expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
