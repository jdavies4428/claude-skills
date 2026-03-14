import fs from 'fs/promises';

/**
 * Parse a single CSV line, handling double-quoted fields with embedded commas
 * and escaped quotes (RFC 4180 style).
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Peek ahead: escaped quote ("")
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        current += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
        i += 1;
      } else {
        current += ch;
        i += 1;
      }
    }
  }

  fields.push(current);
  return fields;
}

/**
 * Convert a CSV file to structured tab-separated text.
 *
 * @param {string} filePath - Path to the CSV file
 * @param {object} [opts]
 * @param {number} [opts.maxRows=1000] - Maximum data rows to include (excludes header)
 * @returns {Promise<{ text: string, rowCount: number, columnNames: string[] }>}
 */
export async function csvToText(filePath, opts = {}) {
  const maxRows = opts.maxRows ?? 1000;

  const raw = await fs.readFile(filePath, 'utf8');

  // Normalize line endings
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Drop trailing empty line if present
  if (lines.at(-1) === '') lines.pop();

  if (lines.length === 0) {
    return { text: '', rowCount: 0, columnNames: [] };
  }

  const headerFields = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1, 1 + maxRows);

  const outputLines = [headerFields.join('\t')];
  for (const line of dataLines) {
    if (line.trim() === '') continue;
    const fields = parseCsvLine(line);
    outputLines.push(fields.join('\t'));
  }

  const text = outputLines.join('\n');

  return {
    text,
    rowCount: dataLines.filter((l) => l.trim() !== '').length,
    columnNames: headerFields,
  };
}
