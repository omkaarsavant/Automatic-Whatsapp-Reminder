const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM sent_reminders WHERE policy_number LIKE '%snehal%' OR message LIKE '%snehal%'", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('--- SENT REMINDERS FOR SNEHAL ---');
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
