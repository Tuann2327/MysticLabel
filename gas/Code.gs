function doPost(e) {
  const request = JSON.parse(e.postData.contents);
  const spreadSheet = SpreadsheetApp.getActiveSpreadsheet();

  if (request.action === 'saveSettings') {
    var sheet = spreadSheet.getSheetByName('setting');
    if (!sheet) {
      sheet = spreadSheet.insertSheet('setting');
    }
    sheet.clear();
    sheet.appendRow(['Type', 'Value 1', 'Value 2']);
    const rows = request.data.map(item => [item.type, item.val, item.val2 || '']);
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return ContentService.createTextOutput("Settings Saved Successfully");
  }

  else if (request.action === 'syncOrders') {
    var sheet = spreadSheet.getSheets()[0];
    const rows = request.data.map(row => [row.date, row.orderNumber, row.productTitle, row.size]);
    if (rows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  }

  else if (request.action === 'decrementPrepared') {
    Logger.log('decrementPrepared called with ' + request.data.length + ' item(s)');

    var preparedSheet = spreadSheet.getSheetByName('Prepared');
    if (!preparedSheet) {
      Logger.log('ERROR: Sheet "Prepared" not found. Available sheets: ' +
        spreadSheet.getSheets().map(function(s) { return s.getName(); }).join(', '));
      return ContentService.createTextOutput("Sheet not found").setMimeType(ContentService.MimeType.TEXT);
    }

    var sheetData = preparedSheet.getDataRange().getValues();
    var header = sheetData[0].map(function(h) {
      return String(h).toLowerCase().replace(/\s+/g, '');
    });
    Logger.log('Headers: ' + JSON.stringify(header));

    request.data.forEach(function(item) {
      var itemName = String(item.name).toLowerCase().trim();
      var sizeKey  = String(item.size).toLowerCase().replace(/ml$/i, '').trim() + 'ml';
      var sizeCol  = header.indexOf(sizeKey);

      Logger.log('Looking for: "' + itemName + '" size "' + sizeKey + '" → col ' + sizeCol);

      if (sizeCol === -1) {
        Logger.log('SKIP: size column "' + sizeKey + '" not found in headers');
        return;
      }

      var matched = false;
      for (var r = 1; r < sheetData.length; r++) {
        var rowName = String(sheetData[r][0]).toLowerCase().trim();
        if (rowName !== itemName) continue;

        matched = true;
        var cell    = preparedSheet.getRange(r + 1, sizeCol + 1);
        var current = Number(cell.getValue()) || 0;
        var next    = Math.max(0, current - Number(item.quantity));
        cell.setValue(next);
        Logger.log('Updated row ' + (r + 1) + ' "' + sheetData[r][0] + '" ' + sizeKey + ': ' + current + ' → ' + next);
      }

      if (!matched) {
        Logger.log('SKIP: no row matched name "' + itemName + '"');
      }
    });

    return ContentService.createTextOutput("Done").setMimeType(ContentService.MimeType.TEXT);
  }
}


// ─── Quick write test ────────────────────────────────────────────────────────
// Run this directly in the editor to confirm the sheet write works.
// Change the name/size to match a real row in your Prepared sheet.
function testWriteDecrement() {
  const fakeRequest = {
    action: 'decrementPrepared',
    data: [{ name: 'Afternoon Swim', size: '1', quantity: 1 }]
  };
  const fakeE = { postData: { contents: JSON.stringify(fakeRequest) } };
  const result = doPost(fakeE);
  Logger.log('Result: ' + result.getContent());
}
