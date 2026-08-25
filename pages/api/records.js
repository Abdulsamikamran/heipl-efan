import {
  getGoogleSheetsClient,
  ensureHeaderRow,
  fetchAllSheetRecords,
} from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sheets = await getGoogleSheetsClient();
    await ensureHeaderRow(sheets);
    const records = await fetchAllSheetRecords(sheets);
    return res.status(200).json({ records, count: records.length });
  } catch (error) {
    console.error('pull records error:', error);
    return res.status(500).json({
      error: 'Failed to load records from Google Sheets',
      details: error.message,
    });
  }
}
