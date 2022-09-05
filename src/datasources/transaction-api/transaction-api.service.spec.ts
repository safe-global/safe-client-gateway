import { Balance } from './entities/balance.entity';
import { TransactionApi } from './transaction-api.service';
import { Backbone } from '../../chains/entities';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { ValidationErrorFactory } from '../errors/validation-error-factory';
import { HttpException } from '@nestjs/common';
import backboneFactory from '../../chains/entities/__tests__/backbone.factory';
import { balanceFactory } from './entities/__tests__/balance.factory';
import { JsonSchemaService } from '../../common/schema/json-schema.service';

const BALANCES: Balance[] = [balanceFactory(), balanceFactory()];
const BACKBONE: Backbone = backboneFactory();

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;

const validationErrorFactory = {
  from: jest.fn().mockReturnValue(new HttpException('testErr', 500)),
} as unknown as ValidationErrorFactory;

const validationFunction = jest.fn();
validationFunction.mockImplementation(() => true);

const jsonSchemaService = {
  addSchema: jest.fn(),
  compile: jest.fn().mockImplementation(() => validationFunction),
} as unknown as JsonSchemaService;

const mockDataSource = jest.mocked(dataSource);
const mockValidationErrorFactory = jest.mocked(validationErrorFactory);
const mockJsonSchemaService = jest.mocked(jsonSchemaService);

describe('TransactionApi', () => {
  const service: TransactionApi = new TransactionApi(
    '1',
    'baseUrl',
    mockDataSource,
    mockValidationErrorFactory,
    mockJsonSchemaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Balances', () => {
    it('should return the balances retrieved', async () => {
      mockDataSource.get.mockResolvedValue(BALANCES);
      const balances = await service.getBalances('test', true, true);
      expect(balances).toBe(BALANCES);
    });

    it('should throw a validation error when validation fails', async () => {
      mockDataSource.get.mockResolvedValueOnce(BALANCES);
      validationFunction.mockImplementationOnce(() => false);
      await expect(service.getBackbone()).rejects.toThrow();
      expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
    });

    it('should forward error', async () => {
      mockDataSource.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Some error'));

      await expect(service.getBalances('test', true, true)).rejects.toThrow(
        'Some error',
      );

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backbone', () => {
    it('should return the backbone retrieved', async () => {
      mockDataSource.get.mockResolvedValueOnce(BACKBONE);
      const backbone = await service.getBackbone();
      expect(backbone).toBe(BACKBONE);
    });

    it('should throw a validation error when validation fails', async () => {
      mockDataSource.get.mockResolvedValueOnce(BACKBONE);
      validationFunction.mockImplementation(() => false);
      await expect(service.getBackbone()).rejects.toThrow();
      expect(mockValidationErrorFactory.from).toHaveBeenCalledTimes(1);
    });

    it('should forward error', async () => {
      const err = new Error('testErr');
      mockDataSource.get = jest.fn().mockRejectedValueOnce(err);
      await expect(service.getBackbone()).rejects.toThrow(err.message);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
    });
  });
});
