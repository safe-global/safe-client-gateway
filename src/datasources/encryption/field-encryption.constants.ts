// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Additional authenticated data (AAD) for each encrypted field.
 *
 * Binding ciphertext to a stable, per-field context means a value encrypted for
 * one column cannot be transplanted into another (decryption fails the GCM auth
 * check). The reader always knows the field, so the AAD is reconstructable.
 *
 * These strings are part of the on-disk contract: changing one makes existing
 * ciphertext for that field undecryptable. Treat them as immutable.
 */
export const FieldEncryptionAad = {
  USER_EMAIL: 'users.email',
} as const;
