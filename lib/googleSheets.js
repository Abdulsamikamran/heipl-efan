// SERVER-SIDE ONLY - do not import in client code

import { google } from 'googleapis';
import { getPakistanTimestamp, formatDateForSheets } from './utils';

const PLACEHOLDER_EMAIL = 'your-service-account@project.iam.gserviceaccount.com';

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
];

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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function ensureHeaderRow(sheets) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:BQ1`,
  });

  const existingHeaders = response.data.values?.[0];

  if (!existingHeaders || existingHeaders.length === 0 || !existingHeaders[0]) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A1:BQ1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [SHEET_HEADERS],
      },
    });
  }
}

export function mapRecordToRow(record, agentEmail = '') {
  return [
    getPakistanTimestamp(),
    agentEmail || '',
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
    formatDateForSheets(record.cnicExpiry),
    record.mobileOperator || '',
    record.email || '',
    record.division || '',
    record.tehsil || '',
    record.permanentAddress || '',
  ];
}

export async function appendRows(sheets, rows) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1';

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:BQ`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  });

  return response.data;
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
