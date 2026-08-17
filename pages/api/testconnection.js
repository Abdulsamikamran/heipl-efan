import { testConnection } from '../../lib/googleSheets';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await testConnection();

  if (result.connected) {
    return res.status(200).json({
      connected: true,
      sheetTitle: result.sheetTitle,
      tabName: result.tabName,
    });
  }

  return res.status(200).json({
    connected: false,
    error: result.error,
  });
}
