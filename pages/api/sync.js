import {
  getGoogleSheetsClient,
  ensureHeaderRow,
  mapRecordToRow,
  appendRows,
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

  const chunks = [];
  for (let i = 0; i < records.length; i += 50) {
    chunks.push(records.slice(i, i + 50));
  }

  const syncedIds = [];
  const failedIds = [];
  const errors = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];

    try {
      const rows = chunk.map((record) =>
        mapRecordToRow(record, agentEmail || '', photoUrls[record.id] || {}),
      );
      await appendRows(sheets, rows);
      chunk.forEach((record) => syncedIds.push(record.id));
    } catch (error) {
      chunk.forEach((record) => failedIds.push(record.id));
      errors.push(error.message);
      console.error('Chunk sync error:', error.message);
    }

    if (i < chunks.length - 1) {
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
    }
  }

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
