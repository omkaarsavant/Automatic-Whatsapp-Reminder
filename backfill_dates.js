const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function run() {
  console.log('--- STARTING ROBUST BACKFILL ---');
  
  // Get all rows that need fixing
  const rows = await new Promise((resolve, reject) => {
    db.all("SELECT id, policy_number FROM sent_reminders WHERE target_due_date IS NULL", (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });

  console.log(`Found ${rows.length} rows to fix.`);

  for (const row of rows) {
    // Find the record for this policy
    const record = await new Promise((resolve, reject) => {
      db.get("SELECT due_date FROM records WHERE policy_number = ? LIMIT 1", [row.policy_number], (err, record) => {
        if (err) reject(err); else resolve(record);
      });
    });

    if (record) {
      // Update the sent_reminder
      await new Promise((resolve, reject) => {
        db.run("UPDATE sent_reminders SET target_due_date = ? WHERE id = ?", [record.due_date, row.id], function(err) {
          if (err) reject(err); else resolve();
        });
      });
    }
  }

  console.log('Finished backfilling.');
  db.close();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
