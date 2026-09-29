export interface LedgerRow {
  timestamp: string; // ISO String
  type: 'EXPENSE' | 'WORK';
  id: string; // Unique UUID/hash
  amountOrHours: number; // Numeric amount or hours
  categoryOrTask: string; // Category or core task description
  description: string; // Associated details / notes
  ratio: string; // The configured ratio, e.g. "4h / 1000rs"
}

/**
 * Searches the user's Google Drive for a file named "WorkBack Ledger".
 * Returns spreadsheet ID if found, null otherwise.
 */
export const findLedgerFile = async (token: string): Promise<string | null> => {
  try {
    const q = encodeURIComponent("name = 'WorkBack Ledger' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Drive search failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error('findLedgerFile error:', error);
    return null;
  }
};

/**
 * Creates a brand new Google Sheet named "WorkBack Ledger" and populates the header row.
 * Returns the spreadsheet ID of the created file.
 */
export const createLedgerFile = async (token: string): Promise<string> => {
  try {
    // 1. Create a metadata spreadsheet file
    const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: 'WorkBack Ledger',
        },
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Sheets creation failed: ${createResponse.statusText}`);
    }

    const sheetData = await createResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;

    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID missing in creation response');
    }

    // 2. Add headers to the first sheet
    const headers = [['Timestamp', 'Type', 'ID', 'Amount / Hours', 'Category / Task', 'Description', 'Task Ratio Base & Hours']];
    const headerResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:G1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: headers,
      }),
    });

    if (!headerResponse.ok) {
      throw new Error(`Adding headers failed: ${headerResponse.statusText}`);
    }

    return spreadsheetId;
  } catch (error) {
    console.error('createLedgerFile error:', error);
    throw error;
  }
};

/**
 * Appends a list of rows to the "WorkBack Ledger" sheet.
 * Clears them upon successful sync.
 */
export const appendLedgerRows = async (token: string, spreadsheetId: string, rows: LedgerRow[]): Promise<boolean> => {
  try {
    const values = rows.map((row) => [
      row.timestamp,
      row.type,
      row.id,
      row.amountOrHours,
      row.categoryOrTask,
      row.description,
      row.ratio,
    ]);

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:G:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to append rows: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('appendLedgerRows error:', error);
    return false;
  }
};

/**
 * Completely clears and overwrites the spreadsheet starting from A2 (preserving headers in row 1).
 * Perfect for deletion syncing and updates.
 */
export const overwriteLedgerRows = async (token: string, spreadsheetId: string, rows: LedgerRow[]): Promise<boolean> => {
  try {
    // 1. Clear existing range A2:G first
    const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:G:clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!clearResponse.ok) {
      console.warn('Google Sheets values clear returned non-ok status:', clearResponse.statusText);
    }

    if (rows.length === 0) {
      return true; // Sheet successfully cleared of all logs
    }

    // 2. Overwrite with current local items
    const values = rows.map((row) => [
      row.timestamp,
      row.type,
      row.id,
      row.amountOrHours,
      row.categoryOrTask,
      row.description,
      row.ratio,
    ]);

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:G?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to put values: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('overwriteLedgerRows error:', error);
    return false;
  }
};

/**
 * Downloads all rows from the Google Sheet (optional, for recovery of data)
 */
export const fetchLedgerRows = async (token: string, spreadsheetId: string): Promise<LedgerRow[]> => {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A2:G`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ledger: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.values) return [];

    return data.values.map((row: any) => ({
      timestamp: row[0] || '',
      type: (row[1] as 'EXPENSE' | 'WORK') || 'EXPENSE',
      id: row[2] || '',
      amountOrHours: parseFloat(row[3]) || 0,
      categoryOrTask: row[4] || '',
      description: row[5] || '',
      ratio: row[6] || '',
    }));
  } catch (error) {
    console.error('fetchLedgerRows error:', error);
    return [];
  }
};
