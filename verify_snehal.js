const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- CHECKING SNEHAL STATUS ---');

const sql = `
  SELECT sr.*, r.customer_name 
  FROM sent_reminders sr
  LEFT JOIN records r ON sr.policy_number = r.policy_number
  WHERE sr.target_due_date IS NULL 
  AND (r.customer_name LIKE '%snehal%' OR sr.message LIKE '%snehal%')
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log('Snehal Null Rows:', rows);
    if (rows.length === 0) {
      console.log('SUCCESS: No unsynchronized reminders found for Snehal.');
    }
  }
  db.close();
});
