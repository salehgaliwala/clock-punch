/**
 * Google Apps Script Backend for Punch Clock App
 * 
 * Instructions:
 * 1. Create a Google Sheet.
 * 2. Rename tabs to: "Users", "Projects", "Entries", "Corrections".
 * 3. Go to Extensions -> Apps Script.
 * 4. Paste this code and save.
 * 5. Click "Deploy" -> "New Deployment".
 * 6. Select "Web App".
 * 7. Set "Execute as": Me.
 * 8. Set "Who has access": Anyone (This allows the React app to call it).
 * 9. Copy the Web App URL and paste it into your React App's config.
 */

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'getData') {
    return jsonResponse({
      users: getSheetData('Users'),
      projects: getSheetData('Projects'),
      entries: getSheetData('Entries')
    });
  }
  
  return jsonResponse({ error: 'Invalid action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = (data.action || '').toString().toLowerCase().trim();
  
  try {
    switch (action) {
      case 'punch':
        return handlePunch(data);
      case 'adduser':
        return handleAddUser(data);
      case 'updateuser':
        return handleUpdateUser(data);
      case 'deleteuser':
        return handleDeleteUser(data);
      case 'addproject':
        return handleAddProject(data);
      case 'deleteproject':
        return handleDeleteProject(data);
      case 'editentry':
        return handleEditEntry(data);
      default:
        return jsonResponse({ error: 'Unknown action' });
    }
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function handlePunch(data) {
  const sheet = getSheetByNameRobust('Entries');
  const timestamp = new Date().toISOString();
  
  // Apply 8-hour rule if it's a clock-out
  let note = '';
  if (data.type === 'OUT') {
    note = checkLunchDeduction(data.userId, timestamp);
  }

  sheet.appendRow([
    Utilities.getUuid(),
    data.userId,
    data.project || '',
    data.type,
    timestamp,
    note
  ]);
  
  return jsonResponse({ success: true, timestamp, note });
}

function checkLunchDeduction(userId, outTime) {
  const sheet = getSheetByNameRobust('Entries');
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return '';
  
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const uIdIdx = headers.indexOf('userid');
  const typeIdx = headers.indexOf('type');
  const tsIdx = headers.indexOf('timestamp');
  
  if (uIdIdx === -1 || typeIdx === -1 || tsIdx === -1) return '';

  const today = new Date().toLocaleDateString();
  let inTime = null;
  let hasLunch = false;
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const uId = row[uIdIdx];
    const type = row[typeIdx];
    const ts = row[tsIdx];
    if (!ts) continue;
    
    const rowDate = new Date(ts).toLocaleDateString();
    if (String(uId).trim() === String(userId).trim() && rowDate === today) {
      if (type === 'IN') inTime = new Date(ts);
      if (type === 'LUNCH_IN' || type === 'LUNCH_OUT') hasLunch = true;
    }
  }
  
  if (inTime && !hasLunch) {
    const durationHours = (new Date(outTime) - inTime) / (1000 * 60 * 60);
    if (durationHours >= 8) {
      return 'Auto-deducted 30m lunch (worked >= 8h without lunch clock-out)';
    }
  }
  return '';
}

function handleAddUser(data) {
  const sheet = getSheetByNameRobust('Users');
  sheet.appendRow([data.id, data.name, data.pin, data.role]);
  return jsonResponse({ success: true });
}

function handleUpdateUser(data) {
  const sheet = getSheetByNameRobust('Users');
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.id).trim()) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[data.name, data.pin, data.role]]);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: 'User not found' });
}

function handleDeleteUser(data) {
  const sheet = getSheetByNameRobust('Users');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  let archivedIdx = headers.indexOf('archived');
  
  if (archivedIdx === -1) {
    archivedIdx = headers.length;
    sheet.getRange(1, archivedIdx + 1).setValue('archived');
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.id).trim()) {
      sheet.getRange(i + 1, archivedIdx + 1).setValue('TRUE');
      return jsonResponse({ success: true, message: 'User archived' });
    }
  }
  return jsonResponse({ error: 'User not found' });
}

function handleAddProject(data) {
  const sheet = getSheetByNameRobust('Projects');
  sheet.appendRow([Date.now().toString(), data.name]);
  return jsonResponse({ success: true });
}

function handleDeleteProject(data) {
  const sheet = getSheetByNameRobust('Projects');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  let archivedIdx = headers.indexOf('archived');
  
  if (archivedIdx === -1) {
    archivedIdx = headers.length;
    sheet.getRange(1, archivedIdx + 1).setValue('archived');
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.id).trim()) {
      sheet.getRange(i + 1, archivedIdx + 1).setValue('TRUE');
      return jsonResponse({ success: true, message: 'Project archived' });
    }
  }
  return jsonResponse({ error: 'Project not found' });
}

function handleEditEntry(data) {
  const sheet = getSheetByNameRobust('Entries');
  const rows = sheet.getDataRange().getValues();
  
  // Record correction first
  const corrSheet = getSheetByNameRobust('Corrections');
  corrSheet.appendRow([
    Utilities.getUuid(),
    data.entryId,
    data.oldTimestamp,
    data.newTimestamp,
    data.adminId,
    data.reason
  ]);

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.entryId).trim()) {
      sheet.getRange(i + 1, 5).setValue(data.newTimestamp);
      sheet.getRange(i + 1, 6).setValue('Edited by Admin: ' + data.reason);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ error: 'Entry not found' });
}

function getSheetData(name) {
  const sheet = getSheetByNameRobust(name);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = rows.shift().map(h => h.toString().toLowerCase().trim());
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    return obj;
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetByNameRobust(name) {
  const sheets = SS.getSheets();
  const target = name.toLowerCase().trim();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().trim() === target) {
      return sheets[i];
    }
  }
  
  // Auto-create missing sheets with headers
  const newSheet = SS.insertSheet(name);
  if (target === 'users') {
    newSheet.appendRow(['id', 'name', 'pin', 'role', 'archived']);
  } else if (target === 'projects') {
    newSheet.appendRow(['id', 'name', 'archived']);
  } else if (target === 'entries') {
    newSheet.appendRow(['id', 'userid', 'project', 'type', 'timestamp', 'note']);
  } else if (target === 'corrections') {
    newSheet.appendRow(['id', 'entryId', 'oldTimestamp', 'newTimestamp', 'adminId', 'reason']);
  }
  
  return newSheet;
}
