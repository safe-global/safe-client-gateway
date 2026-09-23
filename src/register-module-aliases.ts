// SPDX-License-Identifier: FSL-1.1-MIT
import path from 'node:path';
import { registerModuleAliases } from './module-aliases';

registerModuleAliases(path.resolve(__dirname, '..'));
