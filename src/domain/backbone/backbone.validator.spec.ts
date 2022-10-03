import { HttpException } from '@nestjs/common';
import { JsonSchemaService } from '../../common/schemas/json-schema.service';
import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { BackboneValidator } from './backbone.validator';

const expectedErrMessage = 'testErrMessage';

const validationErrorFactory = {
  from: jest.fn(),
} as unknown as ValidationErrorFactory;
const mockValidationErrorFactory = jest.mocked(validationErrorFactory);

const validationFunction = jest.fn();

const jsonSchemaService = {
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService;
const mockJsonSchemaService = jest.mocked(jsonSchemaService);

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
