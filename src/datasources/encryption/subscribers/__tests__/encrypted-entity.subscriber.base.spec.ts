// SPDX-License-Identifier: FSL-1.1-MIT
import type { IFieldEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import { EncryptedEntitySubscriber } from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';
import type { ILoggingService } from '@/logging/logging.interface';
import type { DataSource, InsertEvent, UpdateEvent } from 'typeorm';

class TestEntity {
  id!: number;
  address!: string;
  addressHash!: string | null;
}

class TestSubscriber extends EncryptedEntitySubscriber<TestEntity> {
  protected readonly fieldConfigs = [
    {
      field: 'address',
      hashField: 'addressHash',
      postDecrypt: (value: string): string => value.toUpperCase(),
    },
  ];

  listenTo(): typeof TestEntity {
    return TestEntity;
  }
}

const mockEncryptionService = {
  encrypt: jest.fn((v: string) => 'v1:enc-' + v),
  decrypt: jest.fn((v: string) => v.replace('v1:enc-', '')),
  hmac: jest.fn(() => 'a'.repeat(64)),
} as unknown as jest.MockedObjectDeep<IFieldEncryptionService>;

const mockLoggingService = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockDataSource = {
  subscribers: [],
} as unknown as DataSource;

describe('EncryptedEntitySubscriber', () => {
  let subscriber: TestSubscriber;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockDataSource.subscribers as Array<unknown>) = [];
    subscriber = new TestSubscriber(
      mockEncryptionService,
      mockLoggingService,
      mockDataSource,
    );
  });

  it('should register itself with the DataSource', () => {
    expect(mockDataSource.subscribers).toContain(subscriber);
  });

  it('should return the correct entity class from listenTo', () => {
    expect(subscriber.listenTo()).toBe(TestEntity);
  });

  describe('beforeInsert', () => {
    it('should encrypt address in-place and set hash', () => {
      const entity = new TestEntity();
      entity.address = '0xabc';
      entity.addressHash = null;

      const event = { entity } as InsertEvent<TestEntity>;
      subscriber.beforeInsert(event);

      expect(entity.address).toBe('v1:enc-0xabc');
      expect(entity.addressHash).toBe('a'.repeat(64));
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('0xabc');
      expect(mockEncryptionService.hmac).toHaveBeenCalledWith('0xabc');
    });

    it('should skip fields with non-string values', () => {
      const entity = {
        address: undefined,
        addressHash: null,
      } as unknown as TestEntity;

      const event = { entity } as InsertEvent<TestEntity>;
      subscriber.beforeInsert(event);

      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('beforeUpdate', () => {
    it('should encrypt fields on update', () => {
      const entity = new TestEntity();
      entity.address = '0xdef';
      entity.addressHash = null;

      const event = { entity } as unknown as UpdateEvent<TestEntity>;
      subscriber.beforeUpdate(event);

      expect(entity.address).toBe('v1:enc-0xdef');
      expect(entity.addressHash).toBe('a'.repeat(64));
    });

    it('should skip when entity is undefined', () => {
      const event = { entity: undefined } as unknown as UpdateEvent<TestEntity>;
      subscriber.beforeUpdate(event);

      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('afterLoad', () => {
    it('should decrypt encrypted fields and apply postDecrypt', () => {
      const entity = new TestEntity();
      entity.address = 'v1:enc-0xabc';
      entity.addressHash = 'a'.repeat(64);

      subscriber.afterLoad(entity);

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
        'v1:enc-0xabc',
      );
      // postDecrypt applies toUpperCase
      expect(entity.address).toBe('0XABC');
    });

    it('should keep plaintext when value has no v1: prefix (dual-read)', () => {
      const entity = new TestEntity();
      entity.address = '0xExistingPlaintext';
      entity.addressHash = null;

      subscriber.afterLoad(entity);

      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
      expect(entity.address).toBe('0xExistingPlaintext');
    });
  });
});
