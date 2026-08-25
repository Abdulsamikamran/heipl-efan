import {
  getGoogleSheetsClient,
  findRowByRecordId,
  deleteSheetRow,
} from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recordId } = req.body || {};
  if (!recordId) {
    return res.status(400).json({ error: 'recordId is required' });
  }

  try {
    const sheets = await getGoogleSheetsClient();
    const rowNumber = await findRowByRecordId(sheets, recordId);
    if (rowNumber) {
      await deleteSheetRow(sheets, rowNumber);
    }
    return res.status(200).json({ deleted: Boolean(rowNumber), recordId });
  } catch (error) {
    console.error('delete sheet row error:', error);
    return res.status(500).json({
      error: 'Failed to delete row from Google Sheets',
      details: error.message,
    });
  }
}
