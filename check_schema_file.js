const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

let output = '';
const log = (msg) => output += msg + '\n';

db.serialize(() => {
  log('--- RECORDS TABLE ---');
  db.all("PRAGMA table_info(records)", [], (err, rows) => {
    log(JSON.stringify(rows, null, 2));
    
    log('--- SENT_REMINDERS TABLE ---');
    db.all("PRAGMA table_info(sent_reminders)", [], (err, rows) => {
      log(JSON.stringify(rows, null, 2));
      
      log('--- INDEXES ON RECORDS ---');
      db.all("PRAGMA index_list(records)", [], (err, rows) => {
        log(JSON.stringify(rows, null, 2));
        
        db.all("SELECT sql FROM sqlite_master WHERE name='records'", [], (err, rows) => {
          if (rows && rows[0]) log('RECORDS SQL: ' + rows[0].sql);
          
          fs.writeFileSync('d:/Reminder/schema_check.txt', output);
          db.close();
        });
      });
    });
  });
});
