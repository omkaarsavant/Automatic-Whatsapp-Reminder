const { Database } = require('./src/database');
const { Logger } = require('./src/logger');

async function migrate() {
  const logger = new Logger();
  const database = new Database(logger);
  try {
    console.log('Starting migration...');
    await database.init();
    console.log('Migration finished successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
