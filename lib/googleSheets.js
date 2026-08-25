// SERVER-SIDE ONLY - do not import in client code

import { Readable } from 'stream';
import { google } from 'googleapis';
import { getPakistanTimestamp, formatDateForSheets, parseSheetDate } from './utils';

const PLACEHOLDER_EMAIL = 'your-service-account@project.iam.gserviceaccount.com';

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export const SHEET_HEADERS = [
  'Timestamp',
  'Email Address',
  'Form Number',
  'Date',
  'City',
  'Field Agent Name',
  'Agent Employee ID',
  'Agent Mobile Number',
  'Full Name',
  'Father/Husband Name',
  'CNIC Number',
  'Date of Birth',
  'Mobile Number',
  'Alternate Mobile Number',
  'Gender',
  'Marital Status',
  'House / Plot Number',
  'Street/Muhalla',
  'Town / Sector / Colony',
  'City',
  'District',
  'Province',
  'Complete Address (for delivery)',
  'Disco/Utility',
  'Consumer Reference Number',
  'Name on Bill',
  'Bill Month (Latest)',
  'Connection Type',
  'Meter Number',
  'Is Consumer the Home Owner?',
  'Bill in applicant name?',
  'Late payments in last 24 months (approx.)',
  'Active installment on bill?',
  'No. of Fans Requested',
  'Preferred Fan Brand (if any)',
  'Preferred Repayment Tenure',
  'Also applying for Solar?',
  'Fan delivery address same as above?',
  'Alternate Delivery Address',
  'CNIC (Original seen)',
  'CNIC Photocopy taken',
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

export async function uploadPhotoToDrive(drive, base64Data, fileName) {
  try {
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    const search = await drive.files.list({
      q: "name='HEIPL-E2P Photos' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
    });

    let folderId;
    if (search.data.files.length > 0) {
      folderId = search.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: {
            name: 'HEIPL-E2P Photos',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      folderId = folder.data.id;
    }

    const file = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: 'image/jpeg',
        body: Readable.from(buffer),
      },
      fields: 'id, webViewLink',
    });

    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return { fileId: file.data.id, url: file.data.webViewLink };
  } catch (error) {
    console.error('uploadPhotoToDrive error:', error);
    return null;
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

    if (!existingHeaders || existingHeaders.length === 0 || !existingHeaders[0]) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tabName}!A1:${lastColumnLetter()}1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [SHEET_HEADERS],
        },
      });
      return;
    }

    if (existingHeaders.length < SHEET_HEADERS.length) {
      const missingHeaders = SHEET_HEADERS.slice(existingHeaders.length);
      const startCol = existingHeaders.length + 1;
      const endCol = SHEET_HEADERS.length;

      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!${toColumnLetter(startCol)}1:${toColumnLetter(endCol)}1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [missingHeaders],
          },
        });
      } catch (error) {
        console.warn(
          'Could not extend header row (sheet may protect row 1). Continuing sync.',
          error.message,
        );
      }
    }
  } catch (error) {
    console.warn('ensureHeaderRow skipped:', error.message);
  }
}

export function mapRecordToRow(record, agentEmail = '', photoUrls = {}) {
  const submittedEmail = record.submittedByEmail || agentEmail || '';
  return [
    getPakistanTimestamp(),
    submittedEmail,
    record.formNumber || '',
    formatDateForSheets(record.date),
    record.city || '',
    record.fieldAgentName || '',
    record.agentEmployeeId || '',
    record.agentMobileNumber || '',
    record.fullName || '',
    record.fatherHusbandName || '',
    record.cnicNumber || '',
    formatDateForSheets(record.dateOfBirth),
    record.mobileNumber || '',
    record.alternateMobileNumber || '',
    record.gender || '',
    record.maritalStatus || '',
    record.housePlotNumber || '',
    record.streetMohalla || '',
    record.townSectorColony || '',
    record.addressCity || '',
    record.district || '',
    record.province || '',
    record.completeDeliveryAddress || '',
    record.discoUtility || '',
    record.consumerReferenceNumber || '',
    record.nameOnBill || '',
    record.billMonthLatest || '',
    record.connectionType || '',
    record.meterNumber || '',
    record.isHomeOwner || '',
    record.billInApplicantName || '',
    record.latePayments24Months || '',
    record.activeInstallmentOnBill || '',
    record.noOfFansRequested || '',
    record.preferredFanBrand || '',
    record.preferredRepaymentTenure || '',
    record.alsoApplyingForSolar || '',
    record.fanDeliveryAddressSame || '',
    record.alternateDeliveryAddress || '',
    record.cnicOriginalSeen || '',
    record.cnicPhotocopyTaken || '',
    record.latestBillOriginalSeen || '',
    record.billPhotocopyTaken || '',
    record.simRegisteredSameCnic || '',
    record.photoOfConsumerTaken || '',
    record.check1HomeOwner || '',
    record.check2BillInName || '',
    record.check3CnicValid || '',
    record.check4FewerThan4Late || '',
    record.check5NoActiveInstallment || '',
    record.check6SimSameCnic || '',
    record.check7ResidentialOnly || '',
    record.fieldAgentAssessment || '',
    record.reasonIfIneligible || '',
    record.receivedByDeoName || '',
    formatDateForSheets(record.dateReceivedInOffice),
    record.internalBatchFileNo || '',
    record.assignedToDeoLoginId || '',
    formatDateForSheets(record.portalSubmissionDate),
    record.portalReferenceNo || '',
    record.portalSubmissionStatus || '',
    record.deoVerifiedBySupervisor || '',
    formatDateForSheets(record.cnicIssuance),
    record.cnicLifetime ? 'Lifetime' : formatDateForSheets(record.cnicExpiry),
    record.mobileOperator || '',
    record.email || '',
    record.division || '',
    record.tehsil || '',
    record.permanentAddress || '',
    photoUrls.consumer || '',
    photoUrls.cnicFront || '',
    photoUrls.cnicBack || '',
    photoUrls.bill || '',
    record.consumerConsent ? 'Yes' : '',
    record.id || '',
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
  const expiryValue = cell(row, 63);
  const isLifetime = expiryValue.toLowerCase() === 'lifetime';
  const recordId = cell(row, 74) || `legacy-r${rowNumber}`;

  return {
    id: recordId,
    submittedByEmail: cell(row, 1),
    formNumber: cell(row, 2),
    date: parseSheetDate(cell(row, 3)),
    city: cell(row, 4),
    fieldAgentName: cell(row, 5),
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
    streetMohalla: cell(row, 17),
    townSectorColony: cell(row, 18),
    addressCity: cell(row, 19),
    district: cell(row, 20),
    province: cell(row, 21),
    completeDeliveryAddress: cell(row, 22),
    discoUtility: cell(row, 23),
    consumerReferenceNumber: cell(row, 24),
    nameOnBill: cell(row, 25),
    billMonthLatest: cell(row, 26),
    connectionType: cell(row, 27),
    meterNumber: cell(row, 28),
    isHomeOwner: cell(row, 29),
    billInApplicantName: cell(row, 30),
    latePayments24Months: cell(row, 31),
    activeInstallmentOnBill: cell(row, 32),
    noOfFansRequested: cell(row, 33),
    preferredFanBrand: cell(row, 34),
    preferredRepaymentTenure: cell(row, 35),
    alsoApplyingForSolar: cell(row, 36),
    fanDeliveryAddressSame: cell(row, 37),
    alternateDeliveryAddress: cell(row, 38),
    cnicOriginalSeen: cell(row, 39),
    cnicPhotocopyTaken: cell(row, 40),
    latestBillOriginalSeen: cell(row, 41),
    billPhotocopyTaken: cell(row, 42),
    simRegisteredSameCnic: cell(row, 43),
    photoOfConsumerTaken: cell(row, 44),
    check1HomeOwner: cell(row, 45),
    check2BillInName: cell(row, 46),
    check3CnicValid: cell(row, 47),
    check4FewerThan4Late: cell(row, 48),
    check5NoActiveInstallment: cell(row, 49),
    check6SimSameCnic: cell(row, 50),
    check7ResidentialOnly: cell(row, 51),
    fieldAgentAssessment: cell(row, 52),
    reasonIfIneligible: cell(row, 53),
    receivedByDeoName: cell(row, 54),
    dateReceivedInOffice: parseSheetDate(cell(row, 55)),
    internalBatchFileNo: cell(row, 56),
    assignedToDeoLoginId: cell(row, 57),
    portalSubmissionDate: parseSheetDate(cell(row, 58)),
    portalReferenceNo: cell(row, 59),
    portalSubmissionStatus: cell(row, 60),
    deoVerifiedBySupervisor: cell(row, 61),
    cnicIssuance: parseSheetDate(cell(row, 62)),
    cnicExpiry: isLifetime ? '' : parseSheetDate(expiryValue),
    cnicLifetime: isLifetime,
    mobileOperator: cell(row, 64),
    email: cell(row, 65),
    division: cell(row, 66),
    tehsil: cell(row, 67),
    permanentAddress: cell(row, 68),
    consumerPhotoUrl: cell(row, 69),
    cnicFrontPhotoUrl: cell(row, 70),
    cnicBackPhotoUrl: cell(row, 71),
    billPhotoUrl: cell(row, 72),
    consumerConsent: cell(row, 73) === 'Yes',
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
  if (index === -1) return null;
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
