/**
 * BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
 * Google Sheets API Client
 * Server-to-server authentication using Google Service Account
 */

const fs = require('fs');
const path = require('path');
const config = require('../config/environment');
const logger = require('../utils/logger');

let googleapis = null;
try {
  googleapis = require('googleapis');
} catch (e) {
  // googleapis will be loaded when available after npm install
}

/**
 * Header definitions for the 4 worksheets
 */
const SHEET_HEADERS = {
  allAttendees: [
    'Attendee ID',
    'Registration ID',
    'Registration Type',
    'Team ID',
    'Team Name',
    'Full Name',
    'Email',
    'Phone Number',
    'City',
    'Discipline',
    'Experience Level',
    'Track',
    'Role',
    'Registration Date',
    'Email Verification Status',
    'Verification Date',
    'Ticket Code',
    'Ticket Status',
    'Attendance Status',
    'Last Check-in Time',
    'Last Synchronization Time'
  ],
  individualRegistrations: [
    'Registration ID',
    'Attendee ID',
    'Reference Code',
    'Full Name',
    'Email',
    'Phone Number',
    'City',
    'Discipline',
    'Experience Level',
    'Track',
    'Registration Date',
    'Verification Status',
    'Ticket Code',
    'Ticket Status',
    'Last Synchronization Time'
  ],
  teamRegistrations: [
    'Team ID',
    'Registration ID',
    'Reference Code',
    'Team Name',
    'Selected Track',
    'Team Leader Name',
    'Team Leader Email',
    'Attendee ID',
    'Member Name',
    'Member Email',
    'Member Phone',
    'Member Role',
    'Discipline',
    'Registration Date',
    'Verification Status',
    'Ticket Code',
    'Ticket Status',
    'Last Synchronization Time'
  ],
  attendanceRecords: [
    'Attendance ID',
    'Attendee ID',
    'Full Name',
    'Email',
    'Pathway',
    'Team Name',
    'Ticket Code',
    'Session ID',
    'Session Name',
    'Session Date',
    'Check-in Time',
    'Check-in Method',
    'Verified By Staff',
    'Last Synchronization Time'
  ]
};

/**
 * Create an authenticated Google Sheets API client
 */
function getSheetsClient() {
  if (!config.googleSheets.enabled) {
    return { client: null, status: 'DISABLED', error: 'Google Sheets integration is disabled in configuration.' };
  }

  if (!googleapis) {
    return { client: null, status: 'MISSING_DEPENDENCY', error: 'googleapis package is not installed. Run "npm install".' };
  }

  const { google } = googleapis;
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

  try {
    let auth = null;

    // Method A: Service account JSON file
    if (config.googleSheets.keyFilePath) {
      const resolvedPath = path.resolve(process.cwd(), config.googleSheets.keyFilePath);
      if (fs.existsSync(resolvedPath)) {
        auth = new google.auth.GoogleAuth({
          keyFile: resolvedPath,
          scopes
        });
      }
    }

    // Method B: Direct Service account Email & Private Key in env
    if (!auth && config.googleSheets.clientEmail && config.googleSheets.privateKey) {
      auth = new google.auth.JWT(
        config.googleSheets.clientEmail,
        null,
        config.googleSheets.privateKey,
        scopes
      );
    }

    if (!auth) {
      return {
        client: null,
        status: 'UNCONFIGURED',
        error: 'Google Sheets service account credentials not found. Provide GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.'
      };
    }

    const sheets = google.sheets({ version: 'v4', auth });
    return { client: sheets, auth, status: 'READY', error: null };
  } catch (err) {
    logger.error('Failed to initialize Google Sheets client:', err.message);
    return { client: null, status: 'AUTH_ERROR', error: 'Failed to initialize Google Sheets credentials.' };
  }
}

/**
 * Test real connection to the Google Spreadsheet
 */
async function testConnection() {
  if (!config.googleSheets.enabled) {
    return {
      connected: false,
      enabled: false,
      status: 'DISABLED',
      message: 'Google Sheets integration is disabled via GOOGLE_SHEETS_ENABLED=false.'
    };
  }

  const spreadsheetId = (config.googleSheets.spreadsheetId || '').trim();
  if (!spreadsheetId) {
    return {
      connected: false,
      enabled: true,
      status: 'MISSING_SPREADSHEET_ID',
      message: 'GOOGLE_SPREADSHEET_ID is not configured in environment variables.'
    };
  }

  const { client, status, error } = getSheetsClient();
  if (!client) {
    return {
      connected: false,
      enabled: true,
      status,
      message: error
    };
  }

  try {
    const res = await client.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title'
    });

    const title = res.data.properties ? res.data.properties.title : 'Untitled';
    const sheetTitles = (res.data.sheets || []).map(s => s.properties.title);

    return {
      connected: true,
      enabled: true,
      status: 'CONNECTED',
      spreadsheetId,
      spreadsheetTitle: title,
      sheets: sheetTitles,
      serviceAccount: config.googleSheets.clientEmail ? `${config.googleSheets.clientEmail.slice(0, 5)}...` : 'Service Account File',
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Google Sheets connection test failed:', err.message);

    let friendlyError = 'Failed to connect to Google Sheets.';
    if (err.message && err.message.includes('permission')) {
      friendlyError = 'Permission denied: Please ensure the target spreadsheet is shared with the service account email as Editor.';
    } else if (err.code === 404 || (err.message && err.message.includes('not found'))) {
      friendlyError = 'Spreadsheet not found: Verify GOOGLE_SPREADSHEET_ID in your .env configuration.';
    } else if (err.message && err.message.includes('invalid_grant')) {
      friendlyError = 'Invalid service account credentials: Check private key or system clock.';
    }

    return {
      connected: false,
      enabled: true,
      status: 'CONNECTION_FAILED',
      message: friendlyError,
      technicalCode: err.code || null
    };
  }
}

/**
 * Convert 1-based column index to A1 notation letter (1 -> A, 26 -> Z, 27 -> AA, etc.)
 */
function getA1Column(colIndex1Based) {
  let str = '';
  let n = colIndex1Based;
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

/**
 * Ensure all 4 worksheets exist with proper header rows in the target spreadsheet
 */
async function ensureWorksheetsExist() {
  const { client } = getSheetsClient();
  if (!client) return { success: false, error: 'Google Sheets client not available' };

  const spreadsheetId = config.googleSheets.spreadsheetId;
  const sheetNames = config.googleSheets.sheetNames;

  const targetTabs = [
    { name: sheetNames.allAttendees, headers: SHEET_HEADERS.allAttendees },
    { name: sheetNames.individualRegistrations, headers: SHEET_HEADERS.individualRegistrations },
    { name: sheetNames.teamRegistrations, headers: SHEET_HEADERS.teamRegistrations },
    { name: sheetNames.attendanceRecords, headers: SHEET_HEADERS.attendanceRecords }
  ];

  try {
    const doc = await client.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title'
    });

    const existingTabs = new Set((doc.data.sheets || []).map(s => s.properties.title));
    const requests = [];

    // 1. Create missing tabs
    for (const tab of targetTabs) {
      if (!existingTabs.has(tab.name)) {
        requests.push({
          addSheet: {
            properties: {
              title: tab.name,
              gridProperties: { rowCount: 1000, columnCount: tab.headers.length + 5 }
            }
          }
        });
      }
    }

    if (requests.length > 0) {
      await client.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests }
      });
      logger.info(`Created ${requests.length} missing worksheets in spreadsheet.`);
    }

    // 2. Ensure header rows exist in each tab
    for (const tab of targetTabs) {
      const headerRange = `'${tab.name}'!A1:${getA1Column(tab.headers.length)}1`;
      const currentHeaderRes = await client.spreadsheets.values.get({
        spreadsheetId,
        range: `'${tab.name}'!A1:Z1`
      });

      const currentHeaders = currentHeaderRes.data.values && currentHeaderRes.data.values[0];
      if (!currentHeaders || currentHeaders.length === 0) {
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: headerRange,
          valueInputOption: 'RAW',
          requestBody: {
            values: [tab.headers]
          }
        });
        logger.info(`Populated header row for sheet "${tab.name}"`);
      }
    }

    return { success: true };
  } catch (err) {
    logger.error('Failed to ensure worksheets exist:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Idempotently UPSERT a row in a specific worksheet
 * @param {string} sheetName Name of the tab
 * @param {string} idValue Unique DB ID to search for
 * @param {number} idColIndex Zero-based column index where ID is located (e.g. 0 for column A)
 * @param {Array} rowValues Full array of row column values
 */
async function upsertRow(sheetName, idValue, idColIndex, rowValues) {
  const { client } = getSheetsClient();
  if (!client) throw new Error('Google Sheets client is not configured.');

  const spreadsheetId = config.googleSheets.spreadsheetId;
  const colLetter = getA1Column(idColIndex + 1);

  // Fetch all existing IDs in the target column (e.g. 'All Attendees'!A2:A)
  const range = `'${sheetName}'!${colLetter}2:${colLetter}`;
  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range
  });

  const existingIds = res.data.values || [];
  let existingRowIndex = -1;

  for (let i = 0; i < existingIds.length; i++) {
    if (existingIds[i] && String(existingIds[i][0]).trim() === String(idValue).trim()) {
      existingRowIndex = i + 2; // 1-based, offset by 1 for header row
      break;
    }
  }

  const endColLetter = getA1Column(rowValues.length);

  if (existingRowIndex > 0) {
    // UPDATE existing row
    const updateRange = `'${sheetName}'!A${existingRowIndex}:${endColLetter}${existingRowIndex}`;
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: updateRange,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues]
      }
    });
    return { action: 'UPDATED', rowIndex: existingRowIndex };
  } else {
    // APPEND new row
    const appendRange = `'${sheetName}'!A:${endColLetter}`;
    const appendRes = await client.spreadsheets.values.append({
      spreadsheetId,
      range: appendRange,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues]
      }
    });
    return { action: 'APPENDED', updatedRange: appendRes.data.updates ? appendRes.data.updates.updatedRange : null };
  }
}

module.exports = {
  SHEET_HEADERS,
  getSheetsClient,
  testConnection,
  ensureWorksheetsExist,
  upsertRow
};
