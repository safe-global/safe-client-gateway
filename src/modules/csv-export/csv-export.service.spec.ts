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
});
