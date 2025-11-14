import type { Hex } from 'viem';
import { encodeFunctionData } from 'viem';
import SafeMigration from '@/abis/safe/v1.4.1/SafeMigration.abi';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';

// migrateL2Singleton (no args)

class MigrateL2SingletonEncoder extends Builder<object> implements IEncoder {
  encode(): Hex {
    return encodeFunctionData({
      abi: SafeMigration,
      functionName: 'migrateL2Singleton',
    });
  }
}

export function migrateL2SingletonEncoder(): MigrateL2SingletonEncoder {
  return new MigrateL2SingletonEncoder();
}

// migrateL2WithFallbackHandler (no args)

class MigrateL2WithFallbackHandlerEncoder
  extends Builder<object>
  implements IEncoder
{
  encode(): Hex {
    return encodeFunctionData({
      abi: SafeMigration,
      functionName: 'migrateL2WithFallbackHandler',
    });
  }
}

export function migrateL2WithFallbackHandlerEncoder(): MigrateL2WithFallbackHandlerEncoder {
  return new MigrateL2WithFallbackHandlerEncoder();
}

// migrateSingleton (no args)

class MigrateSingletonEncoder extends Builder<object> implements IEncoder {
  encode(): Hex {
    return encodeFunctionData({
      abi: SafeMigration,
      functionName: 'migrateSingleton',
    });
  }
}

export function migrateSingletonEncoder(): MigrateSingletonEncoder {
  return new MigrateSingletonEncoder();
}

// migrateWithFallbackHandler (no args)

class MigrateWithFallbackHandlerEncoder
  extends Builder<object>
  implements IEncoder
{
  encode(): Hex {
    return encodeFunctionData({
      abi: SafeMigration,
      functionName: 'migrateWithFallbackHandler',
    });
  }
}

export function migrateWithFallbackHandlerEncoder(): MigrateWithFallbackHandlerEncoder {
  return new MigrateWithFallbackHandlerEncoder();
}
