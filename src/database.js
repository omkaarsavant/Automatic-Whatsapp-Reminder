const sqlite3 = require('sqlite3').verbose();
const { Logger } = require('./logger');
const path = require('path');

class Database {
  constructor(logger) {
    this.logger = logger;
    this.db = null;
    this.dbPath = path.join(__dirname, '../database.sqlite');
  }

  async init() {
    try {
      this.logger.info('Initializing database...');

      this.db = new sqlite3.Database(this.dbPath);

      await this.createTables();
      await this.migrateDatabase();

      this.logger.info('Database initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async createTables() {
    const createTablesSql = `
      CREATE TABLE IF NOT EXISTS records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        policy_number TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        premium_amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        policy_status TEXT NOT NULL,
        email TEXT,
        policy_type TEXT,
        premium_frequency TEXT,
        last_payment_date TEXT,
        next_due_date TEXT,
        source_file TEXT,
        created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
        updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
        processed_at TIMESTAMP,
        UNIQUE(policy_number, due_date)
      );

      CREATE TABLE IF NOT EXISTS sent_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        policy_number TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        message TEXT NOT NULL,
        reminder_type TEXT NOT NULL,
        target_due_date TEXT,
        sent_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
        status TEXT DEFAULT 'sent',
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        timestamp TIMESTAMP DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS rate_limit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone_number TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT (datetime('now', 'localtime')),
        message_count INTEGER DEFAULT 1,
        window_start TIMESTAMP,
        window_end TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
        updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime'))
      );
    `;

    await this.execSql(createTablesSql);
  }

  async migrateDatabase() {
    // Add source_file column if it doesn't exist (migration)
    try {
      await this.runSql('SELECT source_file FROM records LIMIT 1');
    } catch (e) {
      this.logger.info('Migrating database: adding source_file column to records...');
      await this.runSql('ALTER TABLE records ADD COLUMN source_file TEXT');
    }

    // Verify and fix records table unique constraint
    try {
      const tableInfo = await this.getSql("SELECT sql FROM sqlite_master WHERE name='records'");
      const sql = tableInfo.sql;
      
      // If the table definition contains "policy_number TEXT UNIQUE", we need to rebuild it
      if (sql.includes('policy_number TEXT UNIQUE')) {
        this.logger.info('Migrating database: rebuilding records table to remove strict unique constraint...');
        
        // 1. Rename old table
        await this.runSql('ALTER TABLE records RENAME TO records_old');
        
        // 2. Create new table with correct schema
        await this.runSql(`
          CREATE TABLE records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            policy_number TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            phone_number TEXT NOT NULL,
            premium_amount REAL NOT NULL,
            due_date TEXT NOT NULL,
            policy_status TEXT NOT NULL,
            email TEXT,
            policy_type TEXT,
            premium_frequency TEXT,
            last_payment_date TEXT,
            next_due_date TEXT,
            source_file TEXT,
            created_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
            updated_at TIMESTAMP DEFAULT (datetime('now', 'localtime')),
            processed_at TIMESTAMP,
            UNIQUE(policy_number, due_date)
          )
        `);
        
        // 3. Copy data (ignoring duplicates if any already exist somehow)
        await this.runSql(`
          INSERT OR IGNORE INTO records (
            id, policy_number, customer_name, phone_number, premium_amount, due_date,
            policy_status, email, policy_type, premium_frequency, last_payment_date, 
            next_due_date, source_file, created_at, updated_at, processed_at
          )
          SELECT 
            id, policy_number, customer_name, phone_number, premium_amount, due_date,
            policy_status, email, policy_type, premium_frequency, last_payment_date, 
            next_due_date, source_file, created_at, updated_at, processed_at
          FROM records_old
        `);
        
        // 4. Drop old table
        await this.runSql('DROP TABLE records_old');
        this.logger.info('Records table rebuilt successfully with composite unique key');
      }
    } catch (e) {
      this.logger.error('Migration error (records rebuild):', e.message);
    }

    // Ensure target_due_date exists in sent_reminders
    try {
      await this.runSql('SELECT target_due_date FROM sent_reminders LIMIT 1');
    } catch (e) {
      this.logger.info('Migrating database: adding target_due_date to sent_reminders...');
      await this.runSql('ALTER TABLE sent_reminders ADD COLUMN target_due_date TEXT');
    }

    // Update unique constraint to (policy_number, due_date)
    try {
      // SQLite doesn't support DROP CONSTRAINT well, so we use a different approach
      // but first check if we already have the new index pattern
      const indexInfo = await this.allSql("PRAGMA index_list('records')");
      const hasCompositeIndex = indexInfo.some(idx => idx.name === 'idx_policy_due');
      
      if (!hasCompositeIndex) {
        this.logger.info('Migrating database: adding composite unique index (policy_number, due_date)...');
        // Remove the old unique constraint if possible, but since it was defined in CREATE TABLE directly,
        // we'll just add a new UNIQUE index and stop using the old one if we were to recreate the table.
        // For now, adding a named UNIQUE index is the most robust way to ensure we can check it.
        await this.runSql('CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_due ON records(policy_number, due_date)');
      }
    } catch (e) {
      this.logger.error('Migration error (composite index):', e.message);
    }
    // Ensure indexes exist
    const indexSql = `
      CREATE INDEX IF NOT EXISTS idx_records_due_date ON records(due_date);
      CREATE INDEX IF NOT EXISTS idx_records_phone_number ON records(phone_number);
      CREATE INDEX IF NOT EXISTS idx_records_source_file ON records(source_file);
      CREATE INDEX IF NOT EXISTS idx_sent_policy_date ON sent_reminders(policy_number, target_due_date);
      CREATE INDEX IF NOT EXISTS idx_sent_reminders_policy_number ON sent_reminders(policy_number);
      CREATE INDEX IF NOT EXISTS idx_sent_reminders_sent_at ON sent_reminders(sent_at);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_phone ON rate_limit_logs(phone_number);
      CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON rate_limit_logs(window_start, window_end);
    `;

    await this.execSql(indexSql);

    // Initialize default config values
    await this.initDefaultConfig();

    // Initialize session table if empty
    await this.initSessionTable();
  }

  async initDefaultConfig() {
    const defaultConfig = {
      'system.uptime': '0',
      'rate_limit.daily': '200',
      'reminder.types': 'today,two_days_before,five_days_before',
      'cleanup.interval': 'daily',
      'cleanup.days_to_keep': '30',
      'system.max_retries': '3',
      'system.retry_delay': '5000',
      'whatsapp.auto_reconnect': 'true',
      'whatsapp.max_reconnect_attempts': '5',
      'whatsapp.reconnect_delay': '5000',
      'excel.input_dir': 'data/excel',
      'excel.processed_dir': 'data/excel/processed',
      'logging.level': 'info',
      'logging.file.max_size': '10m',
      'logging.file.max_files': '7'
    };

    for (const [key, value] of Object.entries(defaultConfig)) {
      await this.runSql(
        'INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)',
        [key, value]
      );
    }
  }

  async initSessionTable() {
    const countSql = 'SELECT COUNT(*) as count FROM whatsapp_sessions';
    const result = await this.getSingleSql(countSql);

    if (result.count === 0) {
      // Create a default session entry
      await this.runSql(
        'INSERT INTO whatsapp_sessions (session_data) VALUES (?)',
        ['{}']
      );
    }
  }

  async saveRecords(records, sourceFile = null) {
    const insertSql = `
      INSERT OR REPLACE INTO records (
        policy_number, customer_name, phone_number, premium_amount, due_date,
        policy_status, email, policy_type, premium_frequency, last_payment_date, next_due_date, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertPromises = records.map(record => {
      // Format dates as YYYY-MM-DD for consistent SQL comparison without timezone shifting
      const formatDate = (d) => {
        if (!d) return null;
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return null;
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };

      return this.runSql(insertSql, [
        record.policy_number,
        record.customer_name,
        record.phone_number,
        record.premium_amount,
        formatDate(record.due_date),
        record.policy_status,
        record.email,
        record.policy_type,
        record.premium_frequency,
        formatDate(record.last_payment_date),
        formatDate(record.next_due_date),
        sourceFile
      ]);
    });

    await Promise.all(insertPromises);
  }

  async deleteRecordsBySource(sourceFile) {
    const sql = 'DELETE FROM records WHERE source_file = ?';
    const result = await this.runSql(sql, [sourceFile]);
    return result.changes;
  }

  async deleteRecordsNotInList(sourceFile, records) {
    if (!records || records.length === 0) {
      return await this.deleteRecordsBySource(sourceFile);
    }

    // To handle composite keys (policy_number, due_date), we delete anything from this source
    // that doesn't match a (policy, date) pair in our current list.
    const formatDate = (dt) => {
      const d = new Date(dt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Construct pairs for the query
    const pairs = records.map(r => `('${r.policy_number}', '${formatDate(r.due_date)}')`).join(',');
    
    const sql = `
      DELETE FROM records 
      WHERE source_file = ? 
      AND (policy_number, due_date) NOT IN (${pairs})
    `;
    
    const result = await this.runSql(sql, [sourceFile]);
    return result.changes;
  }

  async getRecordsForReminders() {
    const sql = `
      SELECT * FROM records
      WHERE processed_at IS NULL
      ORDER BY due_date ASC
    `;

    return await this.allSql(sql);
  }

  async markRecordProcessed(policyNumber, dueDate) {
    const sql = `
      UPDATE records
      SET processed_at = ?
      WHERE policy_number = ? AND due_date = ?
    `;

    // Ensure dueDate is in YYYY-MM-DD format for matching
    const formattedDate = dueDate instanceof Date ? 
      `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}` : 
      dueDate;

    await this.runSql(sql, [new Date().toLocaleString('sv-SE').replace(' ', 'T'), policyNumber, formattedDate]);
  }

  async saveSentReminder(reminder) {
    const sql = `
      INSERT INTO sent_reminders (policy_number, phone_number, message, reminder_type, target_due_date, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // Format target_due_date consistently
    const targetDate = reminder.due_date instanceof Date ? 
      `${reminder.due_date.getFullYear()}-${String(reminder.due_date.getMonth() + 1).padStart(2, '0')}-${String(reminder.due_date.getDate()).padStart(2, '0')}` : 
      reminder.due_date;

    await this.runSql(sql, [
      reminder.policy_number,
      reminder.phone_number,
      reminder.message,
      reminder.reminder_type,
      targetDate,
      'sent',
      null
    ]);
  }

  async hasReminderBeenSent(policyNumber, dueDate, reminderType) {
    // Format dueDate consistently for comparison
    const targetDate = dueDate instanceof Date ? 
      `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}` : 
      dueDate;

    const sql = `
      SELECT COUNT(*) as count FROM sent_reminders
      WHERE policy_number = ? AND reminder_type = ?
      AND date(target_due_date) = date(?)
    `;
    const result = await this.getSingleSql(sql, [policyNumber, reminderType, targetDate]);
    return result && result.count > 0;
  }

  async getRecentSentReminders(limit = 50) {
    const sql = `
      SELECT sr.*, r.customer_name, r.premium_amount, r.due_date, r.policy_type
      FROM sent_reminders sr
      LEFT JOIN records r ON sr.policy_number = r.policy_number AND date(sr.target_due_date) = date(r.due_date)
      ORDER BY sr.sent_at DESC
      LIMIT ?
    `;
    return await this.allSql(sql, [limit]);
  }

  async getUpcomingRecords(days = 30) {
    const sql = `
      SELECT * FROM records
      WHERE date(due_date, 'localtime') >= date('now', 'localtime')
      AND date(due_date, 'localtime') <= date('now', 'localtime', '+' || ? || ' days')
      ORDER BY due_date ASC
    `;
    return await this.allSql(sql, [days]);
  }

  async getRemindersByType() {
    const sql = `
      SELECT reminder_type, COUNT(*) as count
      FROM sent_reminders
      GROUP BY reminder_type
    `;
    return await this.allSql(sql);
  }

  async getDailySendVolume(days = 30) {
    const sql = `
      SELECT date(sent_at) as send_date, COUNT(*) as count
      FROM sent_reminders
      WHERE sent_at >= date('now', '-' || ? || ' days')
      GROUP BY date(sent_at)
      ORDER BY send_date ASC
    `;
    return await this.allSql(sql, [days]);
  }

  async log(level, message, metadata = null) {
    const sql = `
      INSERT INTO logs (level, message, metadata)
      VALUES (?, ?, ?)
    `;

    await this.runSql(sql, [
      level,
      message,
      metadata ? JSON.stringify(metadata) : null
    ]);
  }

  async getRecordStats() {
    const statsSql = `
      SELECT
        COUNT(*) as totalRecords,
        COUNT(DISTINCT policy_number) as activePolicies,
        (SELECT COUNT(*) FROM sent_reminders WHERE sent_at >= date('now', 'localtime', '-7 days')) as remindersSent,
        (SELECT COUNT(*) FROM sent_reminders WHERE status = 'sent' AND sent_at >= date('now', 'localtime', '-7 days')) as successfulDeliveries,
        (SELECT COUNT(*) FROM sent_reminders WHERE status != 'sent' AND sent_at >= date('now', 'localtime', '-7 days')) as failedAttempts,
        (SELECT COUNT(*) FROM records WHERE date(due_date, 'localtime') >= date('now', 'localtime') AND date(due_date, 'localtime') <= date('now', 'localtime', '+7 days')) as upcomingPremiums,
        (SELECT COUNT(*) FROM records WHERE processed_at IS NULL AND date(due_date, 'localtime') >= date('now', 'localtime')) as pendingReminders
      FROM records
    `;

    const uptimeSql = `
      SELECT CAST(value AS INTEGER) as uptime FROM system_config WHERE key = 'system.uptime'
    `;

    const processingSql = `
      SELECT AVG(strftime('%s', updated_at) - strftime('%s', created_at)) * 1000 as avgProcessingTime
      FROM records
      WHERE updated_at >= date('now', '-7 days')
    `;

    const [stats, uptime, processing] = await Promise.all([
      this.getSingleSql(statsSql),
      this.getSingleSql(uptimeSql),
      this.getSingleSql(processingSql)
    ]);

    return {
      totalRecords: stats.totalRecords,
      activePolicies: stats.activePolicies,
      remindersSent: stats.remindersSent,
      successfulDeliveries: stats.successfulDeliveries,
      failedAttempts: stats.failedAttempts,
      upcomingPremiums: stats.upcomingPremiums,
      pendingReminders: stats.pendingReminders,
      uptime: uptime ? uptime.uptime : 0,
      avgProcessingTime: processing ? processing.avgProcessingTime : 0,
      nextCleanup: new Date().toLocaleString(),
      systemStatus: 'running'
    };
  }

  async cleanupOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const sql = `
      DELETE FROM logs
      WHERE timestamp < ?
    `;

    await this.runSql(sql, [cutoffDate.toISOString()]);
    this.logger.info(`Cleaned up logs older than ${daysToKeep} days`);
  }

  async getLogs(level = null, limit = 100) {
    let sql = 'SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?';
    const params = [limit];

    if (level) {
      sql = 'SELECT * FROM logs WHERE level = ? ORDER BY timestamp DESC LIMIT ?';
      params.unshift(level);
    }

    return await this.allSql(sql, params);
  }

  async updateSystemUptime(hours) {
    const sql = `
      INSERT INTO system_config (key, value) VALUES ('system.uptime', ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `;

    await this.runSql(sql, [hours.toString(), hours.toString()]);
  }

  async getConfig(key) {
    const sql = 'SELECT value FROM system_config WHERE key = ?';
    const result = await this.getSingleSql(sql, [key]);
    return result ? result.value : null;
  }

  async setConfig(key, value) {
    const sql = `
      INSERT INTO system_config (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `;

    await this.runSql(sql, [key, value, value]);
  }

  async saveWhatsAppSession(sessionData) {
    const sql = `
      UPDATE whatsapp_sessions
      SET session_data = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `;

    await this.runSql(sql, [JSON.stringify(sessionData)]);
  }

  async getWhatsAppSession() {
    const sql = 'SELECT session_data FROM whatsapp_sessions WHERE id = 1';
    const result = await this.getSingleSql(sql);
    return result ? JSON.parse(result.session_data) : null;
  }

  async saveRateLimitLog(phoneNumber) {
    const currentTimestamp = Date.now();
    const windowSize = 3600000; // 1 hour
    const windowStart = new Date(currentTimestamp - (currentTimestamp % windowSize));
    const windowEnd = new Date(windowStart.getTime() + windowSize);

    const sql = `
      INSERT INTO rate_limit_logs (phone_number, timestamp, message_count, window_start, window_end)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(phone_number, window_start, window_end)
      DO UPDATE SET message_count = message_count + 1, timestamp = ?
    `;

    await this.runSql(sql, [
      phoneNumber,
      currentTimestamp,
      windowStart.toISOString(),
      windowEnd.toISOString(),
      currentTimestamp
    ]);
  }

  async getRateLimitCount(phoneNumber) {
    const currentTimestamp = Date.now();
    const windowSize = 3600000; // 1 hour
    const windowStart = new Date(currentTimestamp - (currentTimestamp % windowSize));
    const windowEnd = new Date(windowStart.getTime() + windowSize);

    const sql = `
      SELECT SUM(message_count) as totalMessages
      FROM rate_limit_logs
      WHERE phone_number = ?
      AND window_start >= ?
      AND window_end <= ?
    `;

    const result = await this.getSingleSql(sql, [
      phoneNumber,
      windowStart.toISOString(),
      windowEnd.toISOString()
    ]);

    return result ? result.totalMessages : 0;
  }

  async cleanupOldRateLimitLogs(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const sql = `
      DELETE FROM rate_limit_logs
      WHERE timestamp < ?
    `;

    await this.runSql(sql, [cutoffDate.toISOString()]);
    this.logger.info(`Cleaned up rate limit logs older than ${daysToKeep} days`);
  }

  async getAllRecords() {
    const sql = 'SELECT * FROM records ORDER BY due_date ASC';
    return await this.allSql(sql);
  }

  async getRecordByPolicyNumber(policyNumber) {
    const sql = 'SELECT * FROM records WHERE policy_number = ?';
    return await this.getSingleSql(sql, [policyNumber]);
  }

  async getSentReminders(policyNumber = null, limit = 100) {
    let sql = 'SELECT * FROM sent_reminders ORDER BY sent_at DESC LIMIT ?';
    const params = [limit];

    if (policyNumber) {
      sql = 'SELECT * FROM sent_reminders WHERE policy_number = ? ORDER BY sent_at DESC LIMIT ?';
      params.unshift(policyNumber);
    }

    return await this.allSql(sql, params);
  }

  async getSystemConfig() {
    const sql = 'SELECT key, value FROM system_config';
    const rows = await this.allSql(sql);

    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  }

  async updateMultipleConfigs(configs) {
    const promises = Object.entries(configs).map(([key, value]) =>
      this.setConfig(key, value)
    );
    await Promise.all(promises);
  }

  async execSql(sql) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not initialized'));
      }
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async runSql(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not initialized'));
      }
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async getSql(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not initialized'));
      }
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async allSql(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        return reject(new Error('Database not initialized'));
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getSingleSql(sql, params = []) {
    const row = await this.getSql(sql, params);
    return row;
  }

  async close() {
    if (this.db) {
      await new Promise((resolve, reject) => {
        this.db.close(err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      this.db = null;
    }
  }
}

module.exports = { Database };