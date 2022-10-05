import backboneFactory from '../balances/entities/__tests__/backbone.factory';
import { JsonSchemaService } from '../schema/json-schema.service';
import { SimpleValidator } from '../schema/simple.validator';
import { BackboneValidator } from './backbone.validator';

const mockSimpleValidator = jest.mocked({
  execute: jest.fn(),
} as unknown as SimpleValidator);

const mockJsonSchemaService = jest.mocked({
  addSchema: jest.fn(),
  compile: jest.fn(),
} as unknown as JsonSchemaService);

describe('Backbone validator', () => {
  const validator = new BackboneValidator(
    mockSimpleValidator,
    mockJsonSchemaService,
  );

  it('should return the data when validation succeed', () => {
    const backbone = backboneFactory();

    const result = validator.validate(backbone);

    expect(result).toBe(backbone);
    expect(mockSimpleValidator.execute).toHaveBeenCalledTimes(1);
  });
});
