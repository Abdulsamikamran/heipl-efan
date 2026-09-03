import { getGoogleDriveClient, uploadPhotoToDrive } from '../../lib/googleSheets';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { photos } = req.body || {};

  if (!Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: 'No photos provided' });
  }

  if (photos.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 photos per request' });
  }

  let drive;

  try {
    drive = await getGoogleDriveClient();
  } catch (error) {
    return res.status(503).json({
      error: 'Google Drive not configured',
      details: error.message,
    });
  }

  const results = [];

  for (const photo of photos) {
    const { id: photoId, recordId, type, base64 } = photo;

    if (!photoId || !recordId || !type || !base64) {
      results.push({
        photoId: photoId || null,
        driveFileId: null,
        driveUrl: null,
        error: 'Missing required photo fields',
      });
      continue;
    }

    const fileName = `${type}_${String(recordId).substring(0, 8)}.jpg`;
    const uploadResult = await uploadPhotoToDrive(drive, base64, fileName);

    if (uploadResult?.url) {
      results.push({
        photoId,
        driveFileId: uploadResult.fileId,
        driveUrl: uploadResult.url,
        error: null,
      });
    } else {
      results.push({
        photoId,
        driveFileId: null,
        driveUrl: null,
        error: uploadResult?.error || 'Upload failed',
      });
    }
  }

  return res.status(200).json({ results });
}
