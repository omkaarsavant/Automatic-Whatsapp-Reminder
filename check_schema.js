const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('--- RECORDS TABLE ---');
  db.all("PRAGMA table_info(records)", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
  });

  console.log('--- SENT_REMINDERS TABLE ---');
  db.all("PRAGMA table_info(sent_reminders)", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
  });

  console.log('--- INDEXES ---');
  db.all("PRAGMA index_list(records)", [], (err, rows) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(rows, null, 2));
  });

  db.all("SELECT sql FROM sqlite_master WHERE name='records'", [], (err, rows) => {
    if (err) console.error(err);
    else console.log('RECORDS SQL:', rows[0].sql);
  });
});

setTimeout(() => db.close(), 2000);
