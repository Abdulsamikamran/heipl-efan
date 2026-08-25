import {
  getGoogleSheetsClient,
  ensureHeaderRow,
  upsertSheetRows,
} from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { records, agentEmail, photoUrls = {} } = req.body || {};

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No records provided' });
  }

  let sheets;

  try {
    sheets = await getGoogleSheetsClient();
  } catch (error) {
    return res.status(503).json({
      error: 'Google Sheets not configured',
      details: error.message,
    });
  }

  try {
    await ensureHeaderRow(sheets);
  } catch (error) {
    console.warn('ensureHeaderRow failed, continuing with append:', error.message);
  }

  const syncedIds = [];
  const failedIds = [];
  const errors = [];

  const photoUrlsById = photoUrls || {};
  const result = await upsertSheetRows(sheets, records, photoUrlsById, agentEmail || '');

  syncedIds.push(...result.syncedIds);
  failedIds.push(...result.failedIds);
  errors.push(...result.errors);

  const responseBody = {
    success: failedIds.length === 0,
    syncedCount: syncedIds.length,
    syncedIds,
    failedCount: failedIds.length,
    failedIds,
    errors,
  };

  if (syncedIds.length === 0 && failedIds.length > 0) {
    return res.status(500).json(responseBody);
  }

  return res.status(200).json(responseBody);
}
