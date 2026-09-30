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
 * Ordered by modifiedTime descending so it always picks the most actively used sheet across devices.
 */
export const findLedgerFile = async (token: string): Promise<string | null> => {
  try {
    const q = encodeURIComponent("name = 'WorkBack Ledger' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false");
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      throw new Error(`Drive search failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error: any) {
    console.error('findLedgerFile error:', error);
    if (error.message === 'AUTH_EXPIRED') throw error;
    return null;
  }
};

/**
 * Retrieves the exact name of the first sheet/tab dynamically to support localized names (e.g. Sheet1, Sheet 1, Hoja 1).
 */
export const getFirstSheetTitle = async (token: string, spreadsheetId: string): Promise<string> => {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.sheets && data.sheets.length > 0 && data.sheets[0].properties?.title) {
        return data.sheets[0].properties.title;
      }
    }
  } catch (e) {
    console.warn('Could not determine sheet title dynamically, defaulting to Sheet1', e);
  }
  return 'Sheet1';
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
      if (createResponse.status === 401) throw new Error('AUTH_EXPIRED');
      throw new Error(`Sheets creation failed: ${createResponse.statusText}`);
    }

    const sheetData = await createResponse.json();
    const spreadsheetId = sheetData.spreadsheetId;

    if (!spreadsheetId) {
      throw new Error('Spreadsheet ID missing in creation response');
    }

    const sheetTitle = sheetData.sheets?.[0]?.properties?.title || 'Sheet1';
    const range = encodeURIComponent(`'${sheetTitle}'!A1:G1`);

    // 2. Add headers to the first sheet
    const headers = [['Timestamp', 'Type', 'ID', 'Amount / Hours', 'Category / Task', 'Description', 'Task Ratio Base & Hours']];
    const headerResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
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
 */
export const appendLedgerRows = async (token: string, spreadsheetId: string, rows: LedgerRow[]): Promise<boolean> => {
  try {
    const sheetTitle = await getFirstSheetTitle(token, spreadsheetId);
    const range = encodeURIComponent(`'${sheetTitle}'!A:G`);

    const values = rows.map((row) => [
      row.timestamp,
      row.type,
      row.id,
      row.amountOrHours,
      row.categoryOrTask,
      row.description,
      row.ratio,
    ]);

    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
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
      if (response.status === 401) throw new Error('AUTH_EXPIRED');
      throw new Error(`Failed to append rows: ${response.statusText}`);
    }

    return true;
  } catch (error: any) {
    console.error('appendLedgerRows error:', error);
    if (error.message === 'AUTH_EXPIRED') throw error;
    return false;
  }
};

/**
 * Completely clears and overwrites the spreadsheet starting from A2 (preserving headers in row 1).
 * Perfect for deletion syncing and updates.
 */
export const overwriteLedgerRows = async (token: string, spreadsheetId: string, rows: LedgerRow[]): Promise<boolean> => {
  try {
    const sheetTitle = await getFirstSheetTitle(token, spreadsheetId);
    const clearRange = encodeURIComponent(`'${sheetTitle}'!A2:G`);

    // 1. Clear existing range A2:G first
    const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, {
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

    const putRange = encodeURIComponent(`'${sheetTitle}'!A2:G`);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${putRange}?valueInputOption=USER_ENTERED`, {
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
      if (response.status === 401) throw new Error('AUTH_EXPIRED');
      throw new Error(`Failed to put values: ${response.statusText}`);
    }

    return true;
  } catch (error: any) {
    console.error('overwriteLedgerRows error:', error);
    if (error.message === 'AUTH_EXPIRED') throw error;
    return false;
  }
};

/**
 * Downloads all rows from the Google Sheet.
 * Normalizes numerical values, types, and strings so they always parse correctly into state.
 */
export const fetchLedgerRows = async (token: string, spreadsheetId: string): Promise<LedgerRow[]> => {
  try {
    const sheetTitle = await getFirstSheetTitle(token, spreadsheetId);
    const range = encodeURIComponent(`'${sheetTitle}'!A2:G`);
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('AUTH_EXPIRED');
      }
      throw new Error(`Failed to fetch ledger: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.values || !Array.isArray(data.values)) return [];

    return data.values.map((row: any) => {
      const rawType = (row[1] || '').toString().trim().toUpperCase();
      const type: 'EXPENSE' | 'WORK' = rawType === 'WORK' ? 'WORK' : 'EXPENSE';
      
      // Clean amount or hours (remove currency symbols, commas, spaces)
      const rawNumStr = (row[3] || '0').toString().replace(/[^0-9.-]+/g, '');
      const amountOrHours = parseFloat(rawNumStr) || 0;

      return {
        timestamp: (row[0] || new Date().toISOString()).toString().trim(),
        type,
        id: (row[2] || Math.random().toString(36).substring(2, 9)).toString().trim(),
        amountOrHours,
        categoryOrTask: (row[4] || '').toString().trim(),
        description: (row[5] || '').toString().trim(),
        ratio: (row[6] || '').toString().trim(),
      };
    });
  } catch (error: any) {
    console.error('fetchLedgerRows error:', error);
    if (error.message === 'AUTH_EXPIRED') throw error;
    return [];
  }
};
