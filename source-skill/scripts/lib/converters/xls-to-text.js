import pkg from 'xlsx';
const { readFile, utils } = pkg;

/**
 * Convert an XLS or XLSX file to structured tab-separated text.
 *
 * @param {string} filePath - Path to the .xls or .xlsx file
 * @param {object} [opts]
 * @param {string} [opts.sheet] - Sheet name to read (default: first sheet)
 * @param {number} [opts.maxRows=1000] - Maximum data rows to include
 * @returns {{ text: string, sheetNames: string[], rowCount: number, columnNames: string[] }}
 */
export function xlsToText(filePath, opts = {}) {
  const maxRows = opts.maxRows ?? 1000;

  const workbook = readFile(filePath);
  const sheetNames = workbook.SheetNames;

  const targetSheet = opts.sheet ?? sheetNames[0];
  if (!targetSheet) {
    throw new Error(`No sheets found in workbook: ${filePath}`);
  }

  const worksheet = workbook.Sheets[targetSheet];
  if (!worksheet) {
    throw new Error(`Sheet "${targetSheet}" not found in workbook: ${filePath}`);
  }

  // rows as arrays: first row becomes headers
  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rows.length === 0) {
    return { text: '', sheetNames, rowCount: 0, columnNames: [] };
  }

  const headerRow = rows[0].map(String);
  const dataRows = rows.slice(1, 1 + maxRows);

  const lines = [headerRow.join('\t')];
  for (const row of dataRows) {
    lines.push(row.map(String).join('\t'));
  }

  const text = lines.join('\n');

  return {
    text,
    sheetNames,
    rowCount: dataRows.length,
    columnNames: headerRow,
  };
}
