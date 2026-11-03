import * as XLSX from 'xlsx';

/** Field aliases for bulk branch CSV/Excel headers (matches legacy batch mapping). */
const HEADER_MAP = Object.freeze({
  branch: ['branch name', 'branch', 'branchname'],
  branch_type: ['branch type', 'branchtype', 'type'],
  site_id: ['site id', 'siteid', 'site_id'],
  zone: ['zone'],
  region: ['region'],
  outlet_code: ['outlet code', 'outletcode'],
  ro_code: ['ro code', 'rocode'],
  sales_area: ['sales area', 'salesarea'],
  outlet_name: ['outlet name', 'outletname'],
  automation_vendor: ['automation vendor', 'automationvendor'],
  phase: ['phase'],
  address: ['address', 'branch address'],
  lat: ['latitude', 'lat'],
  long: ['longitude', 'long', 'lng'],
  phone: ['phone', 'branch phone'],
  email: ['email', 'branch email'],
  web: ['web', 'website', 'url'],
  tags: ['tags', 'group_key', 'group key'],
});

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

function buildHeaderLookup(headers = []) {
  const lookup = {};
  headers.forEach((h) => {
    lookup[normalizeHeader(h)] = h;
  });
  return lookup;
}

function mapRow(row, headerLookup) {
  const out = {};
  for (const [field, variants] of Object.entries(HEADER_MAP)) {
    let value = '';
    for (const variant of variants) {
      const key = headerLookup[normalizeHeader(variant)];
      if (key != null && row[key] != null && String(row[key]).trim() !== '') {
        value = String(row[key]).trim();
        break;
      }
    }
    out[field] = value;
  }
  return out;
}

/**
 * Parse a CSV or Excel File into branch payload objects (no orgId).
 * @returns {Promise<object[]>}
 */
export async function parseBranchBulkFile(file) {
  if (!file) throw new Error('No file selected');

  const ext = String(file.name || '')
    .split('.')
    .pop()
    .toLowerCase();

  if (!['csv', 'xlsx', 'xls'].includes(ext)) {
    throw new Error('Unsupported file type. Upload CSV or Excel (.xlsx / .xls).');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets');

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) throw new Error('File has no data rows');

  const headers = Object.keys(rows[0] || {});
  const headerLookup = buildHeaderLookup(headers);

  const mapped = [];
  for (const row of rows) {
    const branchData = mapRow(row, headerLookup);
    if (!branchData.branch) continue;
    mapped.push(branchData);
  }

  if (!mapped.length) {
    throw new Error('No valid rows found. A "Branch" / "Branch Name" column is required.');
  }

  return mapped;
}

/** Sample headers for downloadable template. */
export const BRANCH_BULK_TEMPLATE_HEADERS = [
  'Branch Name',
  'Branch Type',
  'Site ID',
  'Zone',
  'Region',
  'Address',
  'Latitude',
  'Longitude',
  'Phone',
  'Email',
  'Website',
  'Tags',
  'Outlet Name',
  'Outlet Code',
  'RO Code',
  'Sales Area',
  'Automation Vendor',
  'Phase',
];

export function downloadBranchBulkTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([BRANCH_BULK_TEMPLATE_HEADERS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Branches');
  XLSX.writeFile(wb, 'branch-bulk-upload-template.xlsx');
}
