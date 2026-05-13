/**
 * Google Apps Script Web App for Vinduespudser Data Sync
 * 
 * Deploy this as a Web App with:
 * - Execute as: Me (your Google account)
 * - Who has access: Anyone
 * 
 * The script will store all data in separate sheets within the spreadsheet:
 * - Company (firma information)
 * - Customers (kunder)
 * - Tasks (opgaver)
 * - Invoices (fakturaer)
 * - SyncLog (synkroniseringslog)
 */

// Optional: Set a shared secret token for authentication
const AUTH_TOKEN = ""; // Leave empty to disable authentication

// Sheet names
const SHEETS = {
  COMPANY: "Company",
  CUSTOMERS: "Customers",
  TASKS: "Tasks",
  INVOICES: "Invoices",
  SYNC_LOG: "SyncLog"
};

/**
 * Handle GET requests - return current data from all sheets
 */
function doGet(e) {
  try {
    // Check authentication if token is set
    if (AUTH_TOKEN && e.parameter.token !== AUTH_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Read data from all sheets
    const data = {
      company: readCompanyData(ss),
      customers: readSheetData(ss, SHEETS.CUSTOMERS),
      tasks: readSheetData(ss, SHEETS.TASKS),
      invoices: readSheetData(ss, SHEETS.INVOICES),
      invoiceCounter: readInvoiceCounter(ss),
      lastSynced: new Date().toISOString()
    };
    
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST requests - save data to sheets
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    
    // Check authentication if token is set
    if (AUTH_TOKEN && request.token !== AUTH_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Unauthorized" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // If this is just a test request, return success
    if (request.payload && request.payload.test) {
      return ContentService.createTextOutput(JSON.stringify({ success: true, test: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = request.payload;
    
    // Save company data
    if (payload.company) {
      writeCompanyData(ss, payload.company);
    }
    
    // Save customers
    if (payload.customers && Array.isArray(payload.customers)) {
      writeSheetData(ss, SHEETS.CUSTOMERS, payload.customers, ['id', 'name', 'street', 'postalCode', 'city', 'phone', 'email']);
    }
    
    // Save tasks
    if (payload.tasks && Array.isArray(payload.tasks)) {
      writeSheetData(ss, SHEETS.TASKS, payload.tasks, ['id', 'customerId', 'title', 'date', 'status', 'note', 'interval']);
    }
    
    // Save invoices
    if (payload.invoices && Array.isArray(payload.invoices)) {
      writeSheetData(ss, SHEETS.INVOICES, payload.invoices, ['id', 'invoiceNumber', 'customerId', 'description', 'amount', 'date']);
    }
    
    // Save invoice counter
    if (typeof payload.invoiceCounter === 'number') {
      writeInvoiceCounter(ss, payload.invoiceCounter);
    }
    
    // Log the sync
    logSync(ss, payload);
    
    return ContentService.createTextOutput(JSON.stringify({ success: true, syncedAt: payload.syncedAt }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get or create a sheet with the given name
 */
function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Write company data to the Company sheet
 */
function writeCompanyData(ss, company) {
  const sheet = getOrCreateSheet(ss, SHEETS.COMPANY);
  
  // Clear existing data
  sheet.clear();
  
  // Write headers and data
  sheet.getRange(1, 1, 1, 7).setValues([['name', 'address', 'cvr', 'email', 'phone', 'mobilePay', 'bankAccount']]);
  sheet.getRange(2, 1, 1, 7).setValues([[
    company.name || '',
    company.address || '',
    company.cvr || '',
    company.email || '',
    company.phone || '',
    company.mobilePay || '',
    company.bankAccount || ''
  ]]);
  
  // Format header row
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#e6edf8');
}

/**
 * Read company data from the Company sheet
 */
function readCompanyData(ss) {
  const sheet = ss.getSheetByName(SHEETS.COMPANY);
  if (!sheet || sheet.getLastRow() < 2) {
    return { name: '', address: '', cvr: '', email: '', phone: '', mobilePay: '', bankAccount: '' };
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  const company = {};
  headers.forEach((header, index) => {
    company[header] = data[index] || '';
  });
  
  return company;
}

/**
 * Write array data to a sheet
 */
function writeSheetData(ss, sheetName, data, columns) {
  const sheet = getOrCreateSheet(ss, sheetName);
  
  // Clear existing data
  sheet.clear();
  
  if (data.length === 0) {
    // Just write headers
    sheet.getRange(1, 1, 1, columns.length).setValues([columns]);
    sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#e6edf8');
    return;
  }
  
  // Prepare data rows
  const rows = [columns];
  data.forEach(item => {
    const row = columns.map(col => item[col] !== undefined ? item[col] : '');
    rows.push(row);
  });
  
  // Write all data at once
  sheet.getRange(1, 1, rows.length, columns.length).setValues(rows);
  
  // Format header row
  sheet.getRange(1, 1, 1, columns.length).setFontWeight('bold').setBackground('#e6edf8');
}

/**
 * Read array data from a sheet
 */
function readSheetData(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const data = dataRange.getValues();
  
  return data.map(row => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] !== '' ? row[index] : undefined;
    });
    return item;
  });
}

/**
 * Write invoice counter
 */
function writeInvoiceCounter(ss, counter) {
  const sheet = getOrCreateSheet(ss, SHEETS.COMPANY);
  
  // Store counter in cell A4
  sheet.getRange(4, 1).setValue('invoiceCounter');
  sheet.getRange(4, 2).setValue(counter);
  sheet.getRange(4, 1).setFontWeight('bold');
}

/**
 * Read invoice counter
 */
function readInvoiceCounter(ss) {
  const sheet = ss.getSheetByName(SHEETS.COMPANY);
  if (!sheet || sheet.getLastRow() < 4) {
    return 1;
  }
  
  const value = sheet.getRange(4, 2).getValue();
  return typeof value === 'number' ? value : 1;
}

/**
 * Log sync operation
 */
function logSync(ss, payload) {
  const sheet = getOrCreateSheet(ss, SHEETS.SYNC_LOG);
  
  // Initialize headers if sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([['timestamp', 'customers', 'tasks', 'invoices', 'queueLength', 'syncedAt']]);
    sheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#e6edf8');
  }
  
  // Append sync log entry
  const row = [
    new Date().toISOString(),
    payload.customers ? payload.customers.length : 0,
    payload.tasks ? payload.tasks.length : 0,
    payload.invoices ? payload.invoices.length : 0,
    payload.queue ? payload.queue.length : 0,
    payload.syncedAt || ''
  ];
  
  sheet.appendRow(row);
  
  // Keep only last 100 sync logs
  if (sheet.getLastRow() > 101) {
    sheet.deleteRows(2, sheet.getLastRow() - 101);
  }
}
