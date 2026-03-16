// SPDX-License-Identifier: FSL-1.1-MIT
import { EncryptionLocator } from '@/datasources/encryption/encryption-locator';
import {
  EncryptedEntitySubscriber,
  type EncryptedFieldConfig,
} from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';
import type { IEncryptionService } from '@/datasources/encryption/encryption.service.interface';
import type {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

class TestEntity {
  name!: string;
  nameHash!: string | null;
  encryptionVersion!: number | null;
}

class TestEntitySubscriber extends EncryptedEntitySubscriber<TestEntity> {
  protected readonly fieldConfigs: Array<EncryptedFieldConfig> = [
    { field: 'name', hashField: 'nameHash' },
  ];

  listenTo(): typeof TestEntity {
    return TestEntity;
  }
}

class PostDecryptEntity {
  address!: string;
  addressHash!: string | null;
  encryptionVersion!: number | null;
}

class PostDecryptEntitySubscriber extends EncryptedEntitySubscriber<PostDecryptEntity> {
  protected readonly fieldConfigs: Array<EncryptedFieldConfig> = [
    {
      field: 'address',
      hashField: 'addressHash',
      postDecrypt: (v) => v.toUpperCase(),
    },
  ];

  listenTo(): typeof PostDecryptEntity {
    return PostDecryptEntity;
  }
}

const mockEncryptionService = {
  encrypt: jest.fn(),
  decrypt: jest.fn(),
  hmac: jest.fn(),
  currentVersion: 1,
} as jest.MockedObjectDeep<IEncryptionService>;

let mockDataSource: DataSource;

describe('EncryptedEntitySubscriber', () => {
  let subscriber: TestEntitySubscriber;

  beforeEach(() => {
    mockDataSource = {
      subscribers: [] as Array<EntitySubscriberInterface>,
    } as unknown as DataSource;
    subscriber = new TestEntitySubscriber(mockDataSource);
  });

  afterEach(() => {
    EncryptionLocator.reset();
    jest.resetAllMocks();
  });

  it('should self-register on the data source', () => {
    expect(mockDataSource.subscribers).toContain(subscriber);
  });

  describe('beforeInsert', () => {
    it('should encrypt the field, set hash, and set version', () => {
      EncryptionLocator.setService(mockEncryptionService);
      mockEncryptionService.encrypt.mockReturnValue({
        ciphertext: 'encrypted-name',
        version: 1,
      });
      mockEncryptionService.hmac.mockReturnValue('abc123hash');
      const entity: TestEntity = {
        name: 'Alice',
        nameHash: null,
        encryptionVersion: null,
      };

      subscriber.beforeInsert({
        entity,
      } as InsertEvent<TestEntity>);

      expect(entity.name).toBe('encrypted-name');
      expect(entity.nameHash).toBe('abc123hash');
      expect(entity.encryptionVersion).toBe(1);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith('Alice');
      expect(mockEncryptionService.hmac).toHaveBeenCalledWith('Alice');
    });

    it('should be a no-op when encryption is disabled', () => {
      const entity: TestEntity = {
        name: 'Alice',
        nameHash: null,
        encryptionVersion: null,
      };

      subscriber.beforeInsert({
        entity,
      } as InsertEvent<TestEntity>);

      expect(entity.name).toBe('Alice');
      expect(entity.nameHash).toBeNull();
      expect(entity.encryptionVersion).toBeNull();
    });

    it('should skip null field values', () => {
      EncryptionLocator.setService(mockEncryptionService);
      const entity = {
        name: null,
        nameHash: null,
        encryptionVersion: null,
      } as unknown as TestEntity;

      subscriber.beforeInsert({
        entity,
      } as InsertEvent<TestEntity>);

      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('beforeUpdate', () => {
    it('should re-encrypt the field with current version', () => {
      EncryptionLocator.setService(mockEncryptionService);
      mockEncryptionService.encrypt.mockReturnValue({
        ciphertext: 'new-ciphertext',
        version: 2,
      });
      mockEncryptionService.hmac.mockReturnValue('new-hash');
      (mockEncryptionService as { currentVersion: number }).currentVersion = 2;
      const entity: TestEntity = {
        name: 'Bob',
        nameHash: 'old-hash',
        encryptionVersion: 1,
      };

      subscriber.beforeUpdate({
        entity,
      } as unknown as UpdateEvent<TestEntity>);

      expect(entity.name).toBe('new-ciphertext');
      expect(entity.nameHash).toBe('new-hash');
      expect(entity.encryptionVersion).toBe(2);
    });

    it('should be a no-op when entity is undefined', () => {
      EncryptionLocator.setService(mockEncryptionService);

      subscriber.beforeUpdate({
        entity: undefined,
      } as unknown as UpdateEvent<TestEntity>);

      expect(mockEncryptionService.encrypt).not.toHaveBeenCalled();
    });
  });

  describe('afterLoad', () => {
    it('should decrypt the field when encryptionVersion is set', () => {
      EncryptionLocator.setService(mockEncryptionService);
      mockEncryptionService.decrypt.mockReturnValue('Alice');
      const entity: TestEntity = {
        name: 'encrypted-name',
        nameHash: 'abc123hash',
        encryptionVersion: 1,
      };

      subscriber.afterLoad(entity);

      expect(entity.name).toBe('Alice');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(
        'encrypted-name',
        1,
      );
    });

    it('should return plaintext when encryptionVersion is null', () => {
      EncryptionLocator.setService(mockEncryptionService);
      const entity: TestEntity = {
        name: 'Alice',
        nameHash: null,
        encryptionVersion: null,
      };

      subscriber.afterLoad(entity);

      expect(entity.name).toBe('Alice');
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it('should return plaintext when encryptionVersion is undefined', () => {
      EncryptionLocator.setService(mockEncryptionService);
      const entity = {
        name: 'Alice',
        nameHash: null,
        encryptionVersion: undefined,
      } as unknown as TestEntity;

      subscriber.afterLoad(entity);

      expect(entity.name).toBe('Alice');
      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });

    it('should throw when encrypted data exists but service is unavailable', () => {
      const entity: TestEntity = {
        name: 'encrypted-name',
        nameHash: 'abc123hash',
        encryptionVersion: 1,
      };

      expect(() => subscriber.afterLoad(entity)).toThrow(
        'Encrypted data found but EncryptionService is not available',
      );
    });

    it('should skip decryption for non-string field values', () => {
      EncryptionLocator.setService(mockEncryptionService);
      const entity = {
        name: null,
        nameHash: null,
        encryptionVersion: 1,
      } as unknown as TestEntity;

      subscriber.afterLoad(entity);

      expect(mockEncryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe('DEK rotation', () => {
    it('should write with v2 on update of v1 data', () => {
      EncryptionLocator.setService(mockEncryptionService);
      (mockEncryptionService as { currentVersion: number }).currentVersion = 2;
      mockEncryptionService.encrypt.mockReturnValue({
        ciphertext: 'v2-ciphertext',
        version: 2,
      });
      mockEncryptionService.hmac.mockReturnValue('v2-hash');
      const entity: TestEntity = {
        name: 'plaintext-after-decrypt',
        nameHash: 'v1-hash',
        encryptionVersion: 1,
      };

      subscriber.beforeUpdate({
        entity,
      } as unknown as UpdateEvent<TestEntity>);

      expect(entity.encryptionVersion).toBe(2);
      expect(entity.name).toBe('v2-ciphertext');
    });
  });

  describe('postDecrypt callback', () => {
    it('should apply postDecrypt after decryption', () => {
      const ds = {
        subscribers: [] as Array<EntitySubscriberInterface>,
      } as unknown as DataSource;
      const postDecryptSub = new PostDecryptEntitySubscriber(ds);
      EncryptionLocator.setService(mockEncryptionService);
      mockEncryptionService.decrypt.mockReturnValue('lowercase-value');
      const entity: PostDecryptEntity = {
        address: 'encrypted-addr',
        addressHash: 'hash',
        encryptionVersion: 1,
      };

      postDecryptSub.afterLoad(entity);

      expect(entity.address).toBe('LOWERCASE-VALUE');
    });
  });
});
