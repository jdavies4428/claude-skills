import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { csvToText } from '../scripts/lib/converters/csv-to-text.js';

let tmpDir;
let tmpFile; // reusable helper: write CSV content and return filepath

async function writeCsv(filename, content) {
  const filePath = path.join(tmpDir, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

describe('csvToText', () => {
  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'csv-to-text-test-'));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Basic round-trip
  // -------------------------------------------------------------------------

  it('converts a simple CSV to tab-separated text', async () => {
    const filePath = await writeCsv('simple.csv', 'name,age,city\nAlice,30,NYC\nBob,25,LA\n');
    const { text, rowCount, columnNames } = await csvToText(filePath);

    assert.equal(text, 'name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA');
    assert.equal(rowCount, 2);
    assert.deepEqual(columnNames, ['name', 'age', 'city']);
  });

  // -------------------------------------------------------------------------
  // columnNames extraction
  // -------------------------------------------------------------------------

  it('returns correct columnNames from header row', async () => {
    const filePath = await writeCsv('cols.csv', 'id,title,description,price\n1,Widget,A thing,9.99\n');
    const { columnNames } = await csvToText(filePath);
    assert.deepEqual(columnNames, ['id', 'title', 'description', 'price']);
  });

  it('returns empty columnNames for an empty file', async () => {
    const filePath = await writeCsv('empty.csv', '');
    const { text, rowCount, columnNames } = await csvToText(filePath);
    assert.equal(text, '');
    assert.equal(rowCount, 0);
    assert.deepEqual(columnNames, []);
  });

  it('returns zero rowCount for a header-only file', async () => {
    const filePath = await writeCsv('header-only.csv', 'col1,col2,col3\n');
    const { rowCount, columnNames } = await csvToText(filePath);
    assert.equal(rowCount, 0);
    assert.deepEqual(columnNames, ['col1', 'col2', 'col3']);
  });

  // -------------------------------------------------------------------------
  // Quoted fields with embedded commas
  // -------------------------------------------------------------------------

  it('handles quoted fields containing commas', async () => {
    const filePath = await writeCsv(
      'quoted.csv',
      'name,address\n"Smith, John","123 Main St, Apt 4"\n',
    );
    const { text, rowCount } = await csvToText(filePath);
    assert.equal(text, 'name\taddress\nSmith, John\t123 Main St, Apt 4');
    assert.equal(rowCount, 1);
  });

  it('handles escaped double-quotes inside quoted fields (RFC 4180)', async () => {
    const filePath = await writeCsv('escaped-quotes.csv', 'name,note\n"say ""hello""",test\n');
    const { text } = await csvToText(filePath);
    // The field 'say ""hello""' should decode to: say "hello"
    assert.equal(text, 'name\tnote\nsay "hello"\ttest');
  });

  it('handles a field that is just a quoted empty string', async () => {
    const filePath = await writeCsv('empty-quoted.csv', 'a,b,c\n1,"",3\n');
    const { text } = await csvToText(filePath);
    assert.equal(text, 'a\tb\tc\n1\t\t3');
  });

  // -------------------------------------------------------------------------
  // maxRows limiting
  // -------------------------------------------------------------------------

  it('limits output to maxRows data rows', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => `row${i},value${i}`).join('\n');
    const filePath = await writeCsv('many-rows.csv', `col1,col2\n${rows}\n`);

    const { text, rowCount } = await csvToText(filePath, { maxRows: 3 });
    const lines = text.split('\n');
    // 1 header + 3 data rows
    assert.equal(lines.length, 4);
    assert.equal(rowCount, 3);
    assert.ok(lines[0].startsWith('col1\t'));
  });

  it('maxRows: 0 returns only the header', async () => {
    const filePath = await writeCsv('maxrows-zero.csv', 'a,b\n1,2\n3,4\n');
    const { text, rowCount } = await csvToText(filePath, { maxRows: 0 });
    assert.equal(text, 'a\tb');
    assert.equal(rowCount, 0);
  });

  it('returns all rows when data rows fewer than maxRows', async () => {
    const filePath = await writeCsv('under-limit.csv', 'x,y\n1,2\n3,4\n');
    const { rowCount } = await csvToText(filePath, { maxRows: 1000 });
    assert.equal(rowCount, 2);
  });

  // -------------------------------------------------------------------------
  // Line ending normalization
  // -------------------------------------------------------------------------

  it('handles Windows-style CRLF line endings', async () => {
    const filePath = await writeCsv('crlf.csv', 'a,b\r\n1,2\r\n3,4\r\n');
    const { text, rowCount } = await csvToText(filePath);
    assert.equal(text, 'a\tb\n1\t2\n3\t4');
    assert.equal(rowCount, 2);
  });

  it('handles old Mac-style CR line endings', async () => {
    const filePath = await writeCsv('cr.csv', 'a,b\r1,2\r3,4\r');
    const { text, rowCount } = await csvToText(filePath);
    assert.equal(text, 'a\tb\n1\t2\n3\t4');
    assert.equal(rowCount, 2);
  });

  // -------------------------------------------------------------------------
  // Blank lines in data
  // -------------------------------------------------------------------------

  it('skips blank lines in the data section', async () => {
    const filePath = await writeCsv('blanks.csv', 'a,b\n1,2\n\n3,4\n');
    const { rowCount, text } = await csvToText(filePath);
    // Blank line is skipped, so only 2 data rows
    assert.equal(rowCount, 2);
    assert.equal(text, 'a\tb\n1\t2\n3\t4');
  });
});
