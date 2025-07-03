import type { CsvOptions } from './csv-export.service';
import { CsvExportService } from './csv-export.service';
import { Writable } from 'stream';

describe('CsvExportService', () => {
  let service: CsvExportService;

  beforeEach(() => {
    service = new CsvExportService();
  });

  async function collectCsv<T extends Record<string, unknown>>(
    data: Array<T>,
    options: CsvOptions = {},
  ): Promise<string> {
    const chunks: Array<Buffer> = [];
    const writable = new Writable({
      write(chunk, _, cb): void {
        chunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
        );
        cb();
      },
    });

    await service.exportToCsv(data, writable, options);
    return Buffer.concat(chunks).toString('utf8');
  }

  it('derives columns from the first object and writes header + rows', async () => {
    const data: Array<Record<string, string | number>> = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const csv = await collectCsv(data);

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('derives columns from the first object when columns is []', async () => {
    const data: Array<Record<string, string | number>> = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];

    const csv = await collectCsv(data, { columns: [] });

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,age');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  it('uses explicit columns and preserves their order', async () => {
    const data: Array<Record<string, string | number>> = [
      { id: 1, value: 'x' },
      { id: 2, value: 'y' },
    ];

    const csv = await collectCsv(data, { columns: ['value', 'id'] });

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('value,id');
    expect(lines[1]).toBe('x,1');
    expect(lines[2]).toBe('y,2');
  });

  it('writes only header when data is empty but columns provided', async () => {
    const data: Array<Record<string, string>> = [];

    const csv = await collectCsv(data, { columns: ['c1', 'c2'] });
    expect(csv.trim()).toBe('c1,c2');
  });

  it('omits header when header=false', async () => {
    const data: Array<Record<string, number>> = [{ a: 1, b: 2 }];

    const csv = await collectCsv(data, { header: false });
    expect(csv.trim()).toBe('1,2');
  });

  it('handles empty data array + no headers', async () => {
    const data: Array<Record<string, string>> = [];
    const csv = await collectCsv(data);
    expect(csv.trim()).toBe('');
  });

  it('handles objects with mixed types', async () => {
    const data: Array<
      Record<string, string | number | boolean | object | Array<string>>
    > = [
      {
        name: 'Charlie',
        age: 40,
        active: true,
        tags: ['tag1', 'tag2'],
        details: { foo: 'bar' },
      },
      {
        name: 'Diana',
        age: 35,
        active: false,
        tags: [],
        details: { bar: 'foo' },
      },
    ];

    const csv = await collectCsv(data);
    const lines = csv.trim().split(/\r?\n/);
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('name,age,active,tags,details');
    /* eslint-disable no-useless-escape */
    expect(lines[1]).toBe(
      'Charlie,40,1,\"[\"\"tag1\"\",\"\"tag2\"\"]\",\"{\"\"foo\"\":\"\"bar\"\"}\"',
    );
    expect(lines[2]).toBe('Diana,35,,[],\"{\"\"bar\"\":\"\"foo\"\"}\"');
    /* eslint-enable no-useless-escape */
  });

  it('handles nested objects', async () => {
    const data: Array<Record<string, string | object>> = [
      {
        name: 'Eve',
        details: { age: 28, active: true },
      },
      {
        name: 'Frank',
        details: { age: 32, active: false },
      },
    ];

    const csv = await collectCsv(data, {
      columns: ['name', 'details.age', 'details.active'],
    });

    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('name,details.age,details.active');
    expect(lines[1]).toBe('Eve,28,1');
    expect(lines[2]).toBe('Frank,32,');
  });

  it('handles custom casting', async () => {
    const data: Array<Record<string, boolean>> = [
      { isActive: true },
      { isActive: false },
    ];

    const csv = await collectCsv(data, {
      cast: {
        boolean: (value: boolean) => (value ? 'true' : 'false'),
      },
    });
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('isActive');
    expect(lines[1]).toBe('true');
    expect(lines[2]).toBe('false');
  });

  it('ignores values that are not specified in columns', async () => {
    const data: Array<Record<string, string | number>> = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
    ];

    const csv = await collectCsv(data, { columns: ['id', 'name'] });
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('id,name');
    expect(lines[1]).toBe('1,Alice');
    expect(lines[2]).toBe('2,Bob');
  });
});
