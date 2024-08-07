import * as fs from 'node:fs';
import * as path from 'node:path';
import * as prettier from 'prettier';
import openapiTS, {
  astToString,
  type Method,
  type OpenAPI3,
} from 'openapi-typescript';

const PROD_SWAGGER_URL = 'https://safe-client.safe.global/api';
const STAGING_SWAGGER_URL = 'https://safe-client.staging.5afe.dev/api';

const SDK_FOLDER = path.join(process.cwd(), 'dist', 'sdk');
const SCHEMA_FILE = 'schema.ts';
const SDK_FILE = 'sdk.ts';

const WARNING = `/**
 * This file was auto-generated. Do not make direct changes.
 */`;

/**
 * Main function to generate SDK for Safe Client Gateway:
 *
 * 1. Create 'dist/sdk' folder
 * 2. Scrape Swagger definitions from staging
 * 3. Convert definitions to TypeScript schema, re-exporting components
 * 4. Generate openapi-fetch client factory and singleton
 * 5. Generate path-specific wrappers for client
 * 6. Write schema and SDK files to 'dist/sdk'
 */
async function main(): Promise<void> {
  try {
    fs.mkdirSync(SDK_FOLDER, { recursive: true });

    const definitions = await getSwaggerDefinitions();

    const schema = await getSchema(definitions);
    // Re-export components for import convenience
    const components = getComponents(definitions);

    const client = getClient();
    const wrappers = getWrappers(definitions);

    await Promise.all([
      writeFile(SCHEMA_FILE, [WARNING, schema, components].join('\n\n')),
      writeFile(SDK_FILE, [WARNING, client, wrappers].join('\n\n')),
    ]);

    process.exit();
  } catch (error) {
    fs.rmSync(SDK_FOLDER, { recursive: true });

    throw error;
  }
}
void main();

/**
 * Scrapes Swagger definitions from {@link STAGING_SWAGGER_URL}
 * as that's where new features are added first
 * @returns Swagger definitions object
 *
 * Note: it is possible to get the definitions from NestJS with
 * `SwaggerModule.createDocument` but we scrape to match deployment
 */
async function getSwaggerDefinitions(): Promise<OpenAPI3> {
  const url = `${STAGING_SWAGGER_URL}/swagger-ui-init.js`;
  const swaggerUiInit = await fetch(url).then((res) => {
    if (res.ok) {
      return res.text();
    } else {
      throw new Error(`Failed to fetch ${url}`);
    }
  });

  // Extract options object from swagger-ui-init.js file
  const optionsMatch = swaggerUiInit.match(/let options = (\{[\s\S]*?\});/);
  if (!optionsMatch?.[1]) {
    throw new Error('No options object');
  }

  const options = JSON.parse(optionsMatch[1]);
  return options.swaggerDoc;
}

/**
 * Converts Swagger definitions to TypeScript schema
 * @param definitions - Swagger definitions object
 * @returns TypeScript schema
 */
async function getSchema(definitions: OpenAPI3): Promise<string> {
  return await openapiTS(definitions).then(astToString);
}

/**
 * Directly exports components of Swagger definitions
 * @param definitions - Swagger definitions object
 * @returns Components of TypeScript schema
 */
function getComponents(definitions: OpenAPI3): string {
  if (!definitions.components?.schemas) {
    throw new Error('Failed to find components.schemas object');
  }

  return Object.keys(definitions.components.schemas)
    .map((key) => {
      return `export type ${key} = components["schemas"]["${key}"];`;
    })
    .join('\n');
}

/**
 * Factory for Safe Client Gateway-typed client and singleton
 * @returns - Typed factory and singleton
 */
function getClient(): string {
  const imports = [
    "import _createClient from 'openapi-fetch';",
    `import type { paths, operations } from './${SCHEMA_FILE}';`,
  ];

  // Typed factory, singleton, singleton getter, singleton URL updater
  const client = [
    'const createClient = _createClient<paths>;',
    `let _client = createClient({
  baseUrl: '${PROD_SWAGGER_URL}',
})`,
    `export function getClient() {
  return _client
}`,
    `export function setBaseUrl(baseUrl: string) {
  _client = createClient({ baseUrl });
}`,
  ];

  return [...imports, ...client].join('\n\n');
}

/**
 * Path-specific wrappers for fetching from the Safe Client Gateway
 * @param definitions - Swagger definitions object
 * @returns - Wrapper functions for each path
 */
function getWrappers(definitions: OpenAPI3): string {
  if (!definitions.paths) {
    throw new Error('Failed to find paths object');
  }

  return Object.keys(definitions.paths)
    .map((path) => {
      const pathItemObj = definitions.paths?.[path];
      if (!pathItemObj || '$ref' in pathItemObj) {
        throw new Error('No PathItemObject in path(s)');
      }

      // get, post, put, etc.
      const method = ((): Method => {
        const isFetchMethod = (method: string): method is Method => {
          // prettier-ignore
          return ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'].includes(method);
        };
        const [_method] = Object.keys(pathItemObj);
        if (!isFetchMethod(_method)) {
          throw new Error(`Invalid fetch method: ${_method}`);
        }
        return _method;
      })();

      const operationObject = pathItemObj[method];
      if (!operationObject || !('operationId' in operationObject)) {
        throw new Error(`No operation object for ${path}`);
      }

      // e.g. AboutController_getAbout
      const operationId = operationObject.operationId;
      if (!operationId) {
        throw new Error(`No operationId for ${path}`);
      }

      // e.g. ['AboutController, 'getAbout']
      const [controller, _method] = operationId.split('_');

      // Prevent duplicated by appending controller version to method
      const wrapperName = ((): string => {
        const versionMatch = controller.match(/v\d+/i);
        return versionMatch?.[0] ? _method + versionMatch[0] : _method;
      })();

      // Wrapper types
      const parameterTypes = `operations["${operationId}"]["parameters"]`;
      // requestBody only present if sending body is possible
      const bodyTypes = operationObject?.requestBody
        ? `operations["${operationId}"]["requestBody"]['content']['application/json']`
        : undefined;

      // Wrapper args and corresponding for client
      const wrapperArgs = bodyTypes
        ? `params: ${parameterTypes}, body: ${bodyTypes}`
        : `params: ${parameterTypes}`;
      const clientArgs = bodyTypes ? `params, body` : `params`;

      // Wrapper function
      return `export async function ${wrapperName}(${wrapperArgs}) {
  return _client.${method.toUpperCase()}('${path}', { ${clientArgs} });
}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Writes a prettified file to the {@link SDK_FOLDER}
 * @param fileName - Name of file to write
 * @param content - Content to write
 */
async function writeFile(fileName: string, content: string): Promise<void> {
  const prettified = await prettier.format(content, {
    parser: 'typescript',
  });
  fs.writeFileSync(path.join(SDK_FOLDER, fileName), prettified);
}