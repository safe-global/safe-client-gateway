// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Minimal batch decryption helper to avoid duplication across wrapper services.
 * Decrypts a single field across multiple items concurrently.
 */
export function batchDecryptField<T extends Record<string, any>>(
  fieldName: keyof T,
  items: T[],
  decrypt: (value: T[keyof T]) => Promise<T[keyof T]>,
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const value = item[fieldName];
      return value
        ? { ...item, [fieldName]: (await decrypt(value)) as any }
        : item;
    }),
  );
}

/**
 * Batch decrypt multiple fields on items where nulls are tolerated.
 * Used for members.name and members.alias decryption.
 */
export async function batchDecryptMultiField<T extends Record<string, any>>(
  items: T[],
  fields: Array<{
    name: keyof T;
    decrypt: (value: T[keyof T]) => Promise<T[keyof T]>;
  }>,
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      const decrypted = { ...item };
      for (const field of fields) {
        const value = item[field.name];
        if (value) {
          decrypted[field.name] = (await field.decrypt(value)) as any;
        }
      }
      return decrypted;
    }),
  );
}
