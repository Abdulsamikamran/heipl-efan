// SERVER-SIDE ONLY - do not import in client code

import { Readable } from 'stream';
import { google } from 'googleapis';
import { getPakistanTimestamp, formatDateForSheets, parseSheetDate } from './utils';

const PLACEHOLDER_EMAIL = 'your-service-account@project.iam.gserviceaccount.com';

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// Must match the live Google Sheet column order exactly (75 columns A–BW).
export const SHEET_HEADERS = [
  'Date&Time',
  'Agent Id',
  'Form Number',
  'Date',
  'Field Agent Name',
  'Agents',
  'Agent Employee ID',
  'Agents Mobile Number',
  'Name Of Applicant ',
  'Father\\Husband Name',
  'ID Card Number',
  'Date Of Birth',
  'Mobile Number',
  'Alternate Mobile Number',
  'Gender',
  'Marital Status',
  'House / Plot Number',
  'Town / Sector / Colony',
  'City',
  'Agent Name',
  'District',
  'Province',
  'Complete Address (for delivery)',
  'Disco/Utility',
  'Consumer Reference Number',
  'Bill Month (Latest)',
  'Connection Type',
  'Meter Number',
  'Is Consumer the Home Owner?',
  'Is Consumer the Home Owner?',
  'Bill in applicant name?',
  'Late payments in last 24 months (approx.)',
  'Active installment on bill?',
  'No. of Fans Requested',
  'Preferred Fan Brand (if any)',
  'Preferred Repayment Tenure',
  'Fan delivery address same as above?',
  'Alternate Delivery Address',
  'Fan delivery address same as above?',
  'CNIC (Original seen)',
  'Latest Electricity Bill (Original seen)',
  'Bill Photocopy taken',
  'Consumer mobile SIM registered on same CNIC?',
  'Photo of consumer taken',
  '1. Is the consumer a homeowner (not a tenant)?',
  "2. Is the electricity bill registered in the applicant's name?",
  '3. Is the CNIC valid and registered with NADRA?',
  '4. Fewer than 4 late bill payments in the last 24 months?',
  '5. No active installment plan on electricity bill in last 2 years?',
  '6. Mobile SIM registered under same CNIC?',
  '7. Residential (domestic) connection only?',
  'FIELD AGENT ASSESSMENT',
  'Reason if ineligible / Remarks',
  'Received by (DEO Name)',
  'Date Received in Office',
  'Internal Batch / File No.',
  'Assigned to DEO (Login ID)',
  'Portal Submission Date',
  'Portal Reference No.',
  'Portal Submission Status',
  'DEO Verified By (Supervisor)',
  'CNIC Issuance',
  'CNIC Expiry',
  'Mobile Operator',
  'Email',
  'Division',
  'Tehsil',
  'Permanent Address',
  'Consumer Photo URL',
  'CNIC Front Photo URL',
  'CNIC Back Photo URL',
  'Electricity Bill Photo URL',
  'Consumer Consent',
  'Record Id',
  'Record ID',
];

function toColumnLetter(n) {
  let s = '';
  let num = n;
  while (num > 0) {
    const m = (num - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
}

function lastColumnLetter() {
  return toColumnLetter(SHEET_HEADERS.length);
}

function sheetRange(start = 'A1') {
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';
  return `${tabName}!${start}:${lastColumnLetter()}`;
}

function validateGoogleConfig() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (
    !email ||
    !key ||
    !sheetId ||
    email === PLACEHOLDER_EMAIL ||
    key.includes('YOUR_KEY_HERE') ||
    sheetId === 'your_google_sheet_id_here'
  ) {
    throw new Error('Google Sheets not configured. Please set environment variables.');
  }
}

export async function getGoogleSheetsClient() {
  validateGoogleConfig();

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: SHEETS_SCOPES,
  });

  return google.sheets({ version: 'v4', auth });
}

export async function getGoogleDriveClient() {
  validateGoogleConfig();

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: DRIVE_SCOPES,
  });

  return google.drive({ version: 'v3', auth });
}

function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

async function resolvePhotoFolderId(drive) {
  const configuredFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID || '').trim();
  if (configuredFolderId) {
    return configuredFolderId;
  }

  const search = await drive.files.list({
    q: "name='HEIPL-E2P Photos' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: 'files(id, name)',
    spaces: 'drive',
    pageSize: 10,
  });

  if (search.data.files?.length > 0) {
    return search.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: 'HEIPL-E2P Photos',
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id;
}

export async function uploadPhotoToDrive(drive, base64Data, fileName) {
  try {
    const base64Clean = String(base64Data || '').replace(/^data:image\/\w+;base64,/, '');
    if (!base64Clean) {
      return { error: 'Empty image data' };
    }

    const buffer = Buffer.from(base64Clean, 'base64');
    if (!buffer.length) {
      return { error: 'Invalid base64 image data' };
    }

    const folderId = await resolvePhotoFolderId(drive);

    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'image/jpeg',
        body: bufferToStream(buffer),
      },
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true,
    });

    if (!file.data?.id) {
      return { error: 'Drive create returned no file id' };
    }

    try {
      await drive.permissions.create({
        fileId: file.data.id,
        requestBody: { role: 'reader', type: 'anyone' },
        supportsAllDrives: true,
      });
    } catch (permError) {
      console.warn('Drive permission set failed:', permError.message);
    }

    let viewUrl = file.data.webViewLink;
    if (!viewUrl) {
      try {
        const meta = await drive.files.get({
          fileId: file.data.id,
          fields: 'id, webViewLink, webContentLink',
          supportsAllDrives: true,
        });
        viewUrl = meta.data.webViewLink || meta.data.webContentLink;
      } catch (metaError) {
        console.warn('Drive meta fetch failed:', metaError.message);
      }
    }

    if (!viewUrl) {
      viewUrl = `https://drive.google.com/file/d/${file.data.id}/view`;
    }

    return { fileId: file.data.id, url: viewUrl, error: null };
  } catch (error) {
    console.error('uploadPhotoToDrive error:', error.message || error);
    return {
      fileId: null,
      url: null,
      error: error.message || 'Upload failed',
    };
  }
}

export async function ensureHeaderRow(sheets) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A1:${lastColumnLetter()}1`,
    });

    const existingHeaders = response.data.values?.[0];

    // Only write headers if row 1 is completely empty — never overwrite live headers.
    if (!existingHeaders || existingHeaders.length === 0 || !existingHeaders[0]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:${lastColumnLetter()}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [SHEET_HEADERS],
        },
      });
    }
  } catch (error) {
    console.warn('ensureHeaderRow skipped:', error.message);
  }
}

export function mapRecordToRow(record, agentEmail = '', photoUrls = {}) {
  const submittedEmail = record.submittedByEmail || agentEmail || '';
  const recordId = record.id || '';

  return [
    getPakistanTimestamp(), // A Date&Time
    submittedEmail, // B Agent Id
    record.formNumber || '', // C Form Number
    formatDateForSheets(record.date), // D Date
    record.fieldAgentName || '', // E Field Agent Name
    record.city || '', // F Agents (survey city — only free early column)
    record.agentEmployeeId || '', // G Agent Employee ID
    record.agentMobileNumber || '', // H Agents Mobile Number
    record.fullName || '', // I Name Of Applicant
    record.fatherHusbandName || '', // J Father\Husband Name
    record.cnicNumber || '', // K ID Card Number
    formatDateForSheets(record.dateOfBirth), // L Date Of Birth
    record.mobileNumber || '', // M Mobile Number
    record.alternateMobileNumber || '', // N Alternate Mobile Number
    record.gender || '', // O Gender
    record.maritalStatus || '', // P Marital Status
    '', // Q House / Plot Number (removed from form)
    record.townSectorColony || '', // R Town / Sector / Colony
    record.addressCity || '', // S City
    record.fieldAgentName || '', // T Agent Name
    record.district || '', // U District
    record.province || '', // V Province
    record.completeDeliveryAddress || '', // W Complete Address
    record.discoUtility || '', // X Disco/Utility
    record.consumerReferenceNumber || '', // Y Consumer Reference Number
    '', // Z Bill Month (Latest) — removed
    '', // AA Connection Type — removed
    '', // AB Meter Number — removed
    record.isHomeOwner || '', // AC Is Consumer the Home Owner?
    '', // AD duplicate homeowner header — leave empty
    record.billInApplicantName || '', // AE Bill in applicant name?
    record.latePayments24Months || '', // AF Late payments
    record.activeInstallmentOnBill || '', // AG Active installment
    record.noOfFansRequested || '', // AH No. of Fans
    record.preferredFanBrand || '', // AI Preferred Fan Brand
    record.preferredRepaymentTenure || '', // AJ Preferred Repayment Tenure
    '', // AK Fan delivery same — removed
    record.alternateDeliveryAddress || '', // AL Alternate Delivery Address
    '', // AM duplicate fan-delivery header — leave empty
    record.cnicOriginalSeen || '', // AN CNIC (Original seen)
    record.latestBillOriginalSeen || '', // AO Latest Electricity Bill
    record.billPhotocopyTaken || '', // AP Bill Photocopy taken
    record.simRegisteredSameCnic || '', // AQ SIM registered same CNIC
    record.photoOfConsumerTaken || '', // AR Photo of consumer taken
    record.check1HomeOwner || '', // AS
    record.check2BillInName || '', // AT
    record.check3CnicValid || '', // AU
    record.check4FewerThan4Late || '', // AV
    record.check5NoActiveInstallment || '', // AW
    record.check6SimSameCnic || '', // AX
    record.check7ResidentialOnly || '', // AY
    '', // AZ FIELD AGENT ASSESSMENT — removed
    record.reasonIfIneligible || '', // BA Reason
    record.receivedByDeoName || '', // BB Received by
    formatDateForSheets(record.dateReceivedInOffice), // BC Date Received
    record.internalBatchFileNo || '', // BD Internal Batch
    record.assignedToDeoLoginId || '', // BE Assigned to DEO
    formatDateForSheets(record.portalSubmissionDate), // BF Portal Submission Date
    record.portalReferenceNo || '', // BG Portal Reference No.
    record.portalSubmissionStatus || '', // BH Portal Submission Status
    record.deoVerifiedBySupervisor || '', // BI DEO Verified By
    formatDateForSheets(record.cnicIssuance), // BJ CNIC Issuance
    record.cnicLifetime ? 'Lifetime' : formatDateForSheets(record.cnicExpiry), // BK CNIC Expiry
    record.mobileOperator || '', // BL Mobile Operator
    record.email || '', // BM Email
    record.division || '', // BN Division
    record.tehsil || '', // BO Tehsil
    record.permanentAddress || '', // BP Permanent Address
    photoUrls.consumer || '', // BQ Consumer Photo URL
    photoUrls.cnicFront || '', // BR CNIC Front Photo URL
    photoUrls.cnicBack || '', // BS CNIC Back Photo URL
    photoUrls.bill || '', // BT Electricity Bill Photo URL
    record.consumerConsent ? 'Yes' : '', // BU Consumer Consent
    recordId, // BV Record Id
    recordId, // BW Record ID
  ];
}

export async function appendRows(sheets, rows) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetRange('A'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });

  return response.data;
}

function cell(row, index) {
  return row[index] != null ? String(row[index]).trim() : '';
}

export function mapRowToRecord(row, rowNumber) {
  const expiryValue = cell(row, 62); // BK CNIC Expiry
  const isLifetime = expiryValue.toLowerCase() === 'lifetime';
  const recordId = cell(row, 74) || cell(row, 73) || `legacy-r${rowNumber}`;

  return {
    id: recordId,
    submittedByEmail: cell(row, 1),
    formNumber: cell(row, 2),
    date: parseSheetDate(cell(row, 3)),
    fieldAgentName: cell(row, 4) || cell(row, 19),
    city: cell(row, 5),
    agentEmployeeId: cell(row, 6),
    agentMobileNumber: cell(row, 7),
    fullName: cell(row, 8),
    fatherHusbandName: cell(row, 9),
    cnicNumber: cell(row, 10),
    dateOfBirth: parseSheetDate(cell(row, 11)),
    mobileNumber: cell(row, 12),
    alternateMobileNumber: cell(row, 13),
    gender: cell(row, 14),
    maritalStatus: cell(row, 15),
    housePlotNumber: cell(row, 16),
    townSectorColony: cell(row, 17),
    addressCity: cell(row, 18),
    district: cell(row, 20),
    province: cell(row, 21),
    completeDeliveryAddress: cell(row, 22),
    discoUtility: cell(row, 23),
    consumerReferenceNumber: cell(row, 24),
    billMonthLatest: cell(row, 25),
    connectionType: cell(row, 26),
    meterNumber: cell(row, 27),
    isHomeOwner: cell(row, 28) || cell(row, 29),
    billInApplicantName: cell(row, 30),
    latePayments24Months: cell(row, 31),
    activeInstallmentOnBill: cell(row, 32),
    noOfFansRequested: cell(row, 33),
    preferredFanBrand: cell(row, 34),
    preferredRepaymentTenure: cell(row, 35),
    fanDeliveryAddressSame: cell(row, 36),
    alternateDeliveryAddress: cell(row, 37),
    cnicOriginalSeen: cell(row, 39),
    latestBillOriginalSeen: cell(row, 40),
    billPhotocopyTaken: cell(row, 41),
    simRegisteredSameCnic: cell(row, 42),
    photoOfConsumerTaken: cell(row, 43),
    check1HomeOwner: cell(row, 44),
    check2BillInName: cell(row, 45),
    check3CnicValid: cell(row, 46),
    check4FewerThan4Late: cell(row, 47),
    check5NoActiveInstallment: cell(row, 48),
    check6SimSameCnic: cell(row, 49),
    check7ResidentialOnly: cell(row, 50),
    fieldAgentAssessment: cell(row, 51),
    reasonIfIneligible: cell(row, 52),
    receivedByDeoName: cell(row, 53),
    dateReceivedInOffice: parseSheetDate(cell(row, 54)),
    internalBatchFileNo: cell(row, 55),
    assignedToDeoLoginId: cell(row, 56),
    portalSubmissionDate: parseSheetDate(cell(row, 57)),
    portalReferenceNo: cell(row, 58),
    portalSubmissionStatus: cell(row, 59),
    deoVerifiedBySupervisor: cell(row, 60),
    cnicIssuance: parseSheetDate(cell(row, 61)),
    cnicExpiry: isLifetime ? '' : parseSheetDate(expiryValue),
    cnicLifetime: isLifetime,
    mobileOperator: cell(row, 63),
    email: cell(row, 64),
    division: cell(row, 65),
    tehsil: cell(row, 66),
    permanentAddress: cell(row, 67),
    consumerPhotoUrl: cell(row, 68),
    cnicFrontPhotoUrl: cell(row, 69),
    cnicBackPhotoUrl: cell(row, 70),
    billPhotoUrl: cell(row, 71),
    consumerConsent: cell(row, 72) === 'Yes',
    _sheetRow: rowNumber,
    syncStatus: 'synced',
    syncError: null,
    syncedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchAllSheetRecords(sheets) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:${lastColumnLetter()}`,
  });

  const rows = response.data.values || [];
  return rows
    .map((row, index) => mapRowToRecord(row, index + 2))
    .filter((record) => record.formNumber || record.fullName || record.cnicNumber);
}

export async function findRowByRecordId(sheets, recordId) {
  if (!recordId) return null;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';
  const idCol = lastColumnLetter();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!${idCol}2:${idCol}`,
  });

  const values = response.data.values || [];
  const index = values.findIndex((row) => cell(row, 0) === recordId);
  if (index === -1) {
    // Also check BV (Record Id) one column earlier
    const prevCol = toColumnLetter(SHEET_HEADERS.length - 1);
    const responsePrev = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!${prevCol}2:${prevCol}`,
    });
    const prevValues = responsePrev.data.values || [];
    const prevIndex = prevValues.findIndex((row) => cell(row, 0) === recordId);
    if (prevIndex === -1) return null;
    return prevIndex + 2;
  }
  return index + 2;
}

export async function findRowByFormNumber(sheets, formNumber) {
  if (!formNumber) return null;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!C2:C`,
  });

  const values = response.data.values || [];
  const index = values.findIndex((row) => cell(row, 0) === formNumber);
  if (index === -1) return null;
  return index + 2;
}

export async function updateSheetRow(sheets, rowNumber, rowValues) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A${rowNumber}:${lastColumnLetter()}${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowValues],
    },
  });
}

export async function deleteSheetRow(sheets, rowNumber) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  const sheet = (meta.data.sheets || []).find(
    (item) => item.properties?.title === tabName,
  );
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) {
    throw new Error(`Tab "${tabName}" not found`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}

export async function upsertSheetRows(sheets, records, photoUrlsById = {}, fallbackEmail = '') {
  const syncedIds = [];
  const failedIds = [];
  const errors = [];

  for (const record of records) {
    try {
      const row = mapRecordToRow(
        {
          ...record,
          submittedByEmail: record.submittedByEmail || fallbackEmail,
        },
        record.submittedByEmail || fallbackEmail,
        photoUrlsById[record.id] || {},
      );
      const existingRow =
        (await findRowByRecordId(sheets, record.id)) ||
        (record.formNumber
          ? await findRowByFormNumber(sheets, record.formNumber)
          : null);
      if (existingRow) {
        await updateSheetRow(sheets, existingRow, row);
      } else {
        await appendRows(sheets, [row]);
      }
      syncedIds.push(record.id);
    } catch (error) {
      failedIds.push(record.id);
      errors.push(error.message);
      console.error('upsertSheetRows error:', error.message);
    }
  }

  return { syncedIds, failedIds, errors };
}

export async function testConnection() {
  try {
    const sheets = await getGoogleSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
    });

    return {
      connected: true,
      sheetTitle: response.data.properties?.title || 'Unknown',
      tabName: process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1',
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
