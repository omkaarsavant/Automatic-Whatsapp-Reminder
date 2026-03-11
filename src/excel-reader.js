const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Logger } = require('./logger');
const { Database } = require('./database');
const { RateLimiter } = require('./rate-limiter');

class ExcelReaderService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.rateLimiter = new RateLimiter(logger);
    this.dataDir = path.join(__dirname, '../data');
    this.excelDir = path.join(this.dataDir, 'excel');
    this.processedFiles = new Map(); // Map<filename, { hash, mtime, processedAt }>
    this.fileWatcher = null;
    this.watchDebounceTimers = new Map();
    this.onFileProcessed = null;
  }

  async init() {
    try {
      this.logger.info('Initializing Excel reader service...');

      await this.setupDirectories();
      await this.loadProcessedFiles();
      this.startFileWatcher();

      this.logger.info('Excel reader service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Excel reader service:', error);
      throw error;
    }
  }

  startFileWatcher() {
    if (this.fileWatcher) return;

    try {
      this.fileWatcher = fs.watch(this.excelDir, { persistent: false }, (eventType, filename) => {
        if (!filename) return;
        if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) return;
        if (filename.startsWith('~$')) return; // Ignore temporary Excel owner files
        if (filename.endsWith('.processed')) return;

        // Debounce: wait 2 seconds after last change before processing
        // (Excel saves can trigger multiple events)
        if (this.watchDebounceTimers.has(filename)) {
          clearTimeout(this.watchDebounceTimers.get(filename));
        }

        this.watchDebounceTimers.set(filename, setTimeout(async () => {
          this.watchDebounceTimers.delete(filename);
          this.logger.info(`File watcher detected change in: ${filename}`);

          try {
            const filePath = path.join(this.excelDir, filename);

            // Check if file was deleted
            if (!fs.existsSync(filePath)) {
              this.logger.info(`File ${filename} was deleted, removing records from DB`);
              await this.database.deleteRecordsBySource(filename);
              this.processedFiles.delete(filename);
              await this.saveProcessedFiles();
              return;
            }

            // Re-process the file
            const currentHash = this.computeFileHash(filePath);
            const stored = this.processedFiles.get(filename);

            if (stored && stored.hash === currentHash) {
              return; // No actual content change
            }

            await this.processSingleFile(filename);
            this.processedFiles.set(filename, {
              hash: currentHash,
              mtime: fs.statSync(filePath).mtimeMs,
              processedAt: new Date().toISOString()
            });
            await this.saveProcessedFiles();
            this.logger.info(`Hot-reloaded ${filename} successfully`);

            // Trigger the callback if registered
            if (this.onFileProcessed) {
              await this.onFileProcessed(filename);
            }
          } catch (error) {
            this.logger.error(`File watcher error processing ${filename}:`, error);
          }
        }, 5000));
      });

      this.logger.info('File watcher started on: ' + this.excelDir);
    } catch (error) {
      this.logger.warn('Could not start file watcher:', error.message);
    }
  }

  stopFileWatcher() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      for (const timer of this.watchDebounceTimers.values()) {
        clearTimeout(timer);
      }
      this.watchDebounceTimers.clear();
      this.logger.info('File watcher stopped');
    }
  }

  async setupDirectories() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.excelDir)) {
      fs.mkdirSync(this.excelDir, { recursive: true });
    }
  }

  async loadProcessedFiles() {
    const processedFilePath = path.join(this.dataDir, 'processed-files.json');
    if (fs.existsSync(processedFilePath)) {
      const raw = fs.readFileSync(processedFilePath, 'utf8');
      const parsed = JSON.parse(raw);

      // Migrate from old array format to new object format
      if (Array.isArray(parsed)) {
        this.processedFiles = new Map();
        for (const filename of parsed) {
          this.processedFiles.set(filename, { hash: null, mtime: 0, processedAt: new Date().toISOString() });
        }
        await this.saveProcessedFiles();
        this.logger.info('Migrated processed-files.json from old array format to new hash format');
      } else {
        this.processedFiles = new Map(Object.entries(parsed));
      }
    }
  }

  async saveProcessedFiles() {
    const processedFilePath = path.join(this.dataDir, 'processed-files.json');
    const obj = Object.fromEntries(this.processedFiles);
    fs.writeFileSync(processedFilePath, JSON.stringify(obj, null, 2), 'utf8');
  }

  computeFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  async processExcelFiles() {
    try {
      const files = fs.readdirSync(this.excelDir);
      const excelFiles = files.filter(file =>
        (file.endsWith('.xlsx') || file.endsWith('.xls')) && 
        !file.startsWith('~$') && // Ignore temporary Excel owner files
        !file.endsWith('.processed')
      );

      this.logger.info(`Found ${excelFiles.length} Excel files to check`);

      for (const file of excelFiles) {
        const filePath = path.join(this.excelDir, file);
        const currentHash = this.computeFileHash(filePath);
        const stored = this.processedFiles.get(file);

        if (stored && stored.hash === currentHash) {
          this.logger.info(`Skipping unchanged file: ${file}`);
          continue;
        }

        const changeType = stored ? 'modified' : 'new';
        this.logger.info(`Detected ${changeType} file: ${file}`);

        try {
          await this.processSingleFile(file);
          this.processedFiles.set(file, {
            hash: currentHash,
            mtime: fs.statSync(filePath).mtimeMs,
            processedAt: new Date().toISOString()
          });
          await this.saveProcessedFiles();
        } catch (error) {
          this.logger.error(`Failed to process file ${file}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process Excel files:', error);
      throw error;
    }
  }

  async processSingleFile(fileName) {
    const filePath = path.join(this.excelDir, fileName);
    this.logger.info(`Processing Excel file: ${fileName}`);

    const workbook = new ExcelJS.Workbook();
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await workbook.xlsx.readFile(filePath);
        break; // Success
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) throw error;
        this.logger.warn(`Excel read failed for ${fileName}, retrying in 1s (${retryCount}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    const records = [];
    const headers = this.readHeaders(worksheet);

    for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      if (this.isEmptyRow(row)) continue;

      const record = this.parseRow(row, headers);
      if (record) {
        records.push(record);
      }
    }

    // Sync: remove records from DB that are no longer in this file
    const currentPolicyNumbers = records.map(r => r.policy_number);
    const deleted = await this.database.deleteRecordsNotInList(fileName, currentPolicyNumbers);
    if (deleted > 0) {
      this.logger.info(`Removed ${deleted} stale records no longer in ${fileName}`);
    }

    if (records.length > 0) {
      await this.database.saveRecords(records, fileName);
      this.logger.info(`Synced ${records.length} records from ${fileName}`);
    } else {
      // If file is now empty, delete all records from this source
      await this.database.deleteRecordsBySource(fileName);
      this.logger.info(`No valid records found in ${fileName}, cleared all records from this source`);
    }
  }

  readHeaders(worksheet) {
    const headerRow = worksheet.getRow(1);
    const headers = {};

    headerRow.eachCell((cell, colNum) => {
      const headerText = cell.text.trim().toLowerCase();
      headers[colNum] = this.normalizeHeader(headerText);
    });

    return headers;
  }

  normalizeHeader(header) {
    return header
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  isEmptyRow(row) {
    return row.getCell(1).text.trim() === '';
  }

  parseRow(row, headers) {
    try {
      const record = {
        policy_number: row.getCell(this.getColumnIndex(headers, 'policy_number')).text.trim(),
        customer_name: row.getCell(this.getColumnIndex(headers, 'customer_name')).text.trim(),
        phone_number: row.getCell(this.getColumnIndex(headers, 'phone_number')).text.trim(),
        premium_amount: parseFloat(row.getCell(this.getColumnIndex(headers, 'premium_amount')).text.trim()) || 0,
        due_date: this.parseDate(row.getCell(this.getColumnIndex(headers, 'due_date')).text.trim()),
        policy_status: row.getCell(this.getColumnIndex(headers, 'policy_status')).text.trim().toLowerCase(),
        email: row.getCell(this.getColumnIndex(headers, 'email')).text.trim(),
        policy_type: row.getCell(this.getColumnIndex(headers, 'policy_type')).text.trim(),
        premium_frequency: row.getCell(this.getColumnIndex(headers, 'premium_frequency')).text.trim(),
        last_payment_date: this.parseDate(row.getCell(this.getColumnIndex(headers, 'last_payment_date')).text.trim()),
        next_due_date: this.parseDate(row.getCell(this.getColumnIndex(headers, 'next_due_date')).text.trim())
      };

      if (!this.validateRecord(record)) {
        this.logger.warn(`Invalid record: ${JSON.stringify(record)}`);
        return null;
      }

      return record;
    } catch (error) {
      this.logger.error(`Error parsing row: ${error.message}`);
      return null;
    }
  }

  getColumnIndex(headers, key) {
    for (const colNum in headers) {
      if (headers[colNum].includes(key)) {
        return parseInt(colNum);
      }
    }
    return 1;
  }

  parseDate(dateString) {
    if (!dateString) return null;

    // Handle common delimiter formats (DD/MM/YYYY or YYYY-MM-DD)
    let day, month, year;
    let match = dateString.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      day = parseInt(match[1]);
      month = parseInt(match[2]);
      year = parseInt(match[3]);
    } else {
      match = dateString.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (match) {
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      }
    }

    if (year && month && day) {
      return new Date(year, month - 1, day);
    }

    // Fallback: strictly local interpretation of ISO/Native strings
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Force to local midnight to avoid UTC shifts
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    return null;
  }

  validateRecord(record) {
    const phoneRegex = /^[6-9]\d{9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!record.phone_number || !phoneRegex.test(record.phone_number.replace(/\s/g, ''))) {
      return false;
    }

    if (record.email && record.email.trim() !== '' && !emailRegex.test(record.email)) {
      return false;
    }

    if (!record.due_date) {
      return false;
    }

    return true;
  }

  async getPendingReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await this.database.getRecordsForReminders();
    const reminders = [];

    for (const record of records) {
      const reminderTypes = this.getReminderTypes(record, today);

      for (const reminderType of reminderTypes) {
        // Check if this specific reminder type has already been sent
        const alreadySent = await this.database.hasReminderBeenSent(
          record.policy_number,
          record.due_date,
          reminderType
        );

        if (!alreadySent) {
          reminders.push({
            ...record,
            reminder_type: reminderType
          });
        }
      }
    }

    return reminders;
  }

  getReminderTypes(record, today) {
    const dueDate = new Date(record.due_date);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const daysUntil = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    const types = [];
    if (daysUntil === 0) types.push('today');
    if (daysUntil === 2) types.push('two_days_before');
    if (daysUntil === 5) types.push('five_days_before');

    return types;
  }

  // Keep for backwards compatibility with legacy calls
  getReminderType(record, today) {
    const types = this.getReminderTypes(record, today);
    return types.length > 0 ? types[0] : null;
  }

  async markRecordProcessed(policyNumber) {
    await this.database.markRecordProcessed(policyNumber);
  }

  async getRecordStats() {
    return await this.database.getRecordStats();
  }

  async cleanupOldFiles(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const files = fs.readdirSync(this.excelDir);
    const processedFiles = files.filter(file => file.endsWith('.xlsx.processed') || file.endsWith('.xls.processed'));

    for (const file of processedFiles) {
      const filePath = path.join(this.excelDir, file);
      const fileStats = fs.statSync(filePath);

      if (fileStats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        this.logger.info(`Deleted old file: ${file}`);
      }
    }
  }

  async validateExcelFile(filePath) {
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount < maxRetries) {
      try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.getWorksheet(1);
        if (!worksheet) {
          throw new Error('No worksheet found in Excel file');
        }

        const headers = this.readHeaders(worksheet);
        const requiredHeaders = ['policy_number', 'customer_name', 'phone_number', 'premium_amount', 'due_date'];

        for (const header of requiredHeaders) {
          if (!Object.values(headers).includes(header)) {
            throw new Error(`Missing required header: ${header}`);
          }
        }

        return {
          valid: true,
          headers: headers,
          rowCount: worksheet.rowCount
        };
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          // Only log error on final failure, and use warn if it's a common write lock error
          if (error.message.includes('central directory') || error.message.includes('EBUSY')) {
            this.logger.warn(`Excel file validation failed (likely locked or writing): ${error.message}`);
          } else {
            this.logger.error(`Excel file validation failed: ${error.message}`);
          }
          return {
            valid: false,
            error: error.message
          };
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async previewExcelFile(filePath, maxRows = 5) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('No worksheet found in Excel file');
      }

      const headers = this.readHeaders(worksheet);
      const preview = {
        headers: Object.values(headers),
        rows: []
      };

      for (let rowNum = 2; rowNum <= Math.min(worksheet.rowCount, maxRows + 1); rowNum++) {
        const row = worksheet.getRow(rowNum);
        if (this.isEmptyRow(row)) continue;

        const rowData = {};
        for (const [colNum, header] of Object.entries(headers)) {
          rowData[header] = row.getCell(parseInt(colNum)).text.trim();
        }
        preview.rows.push(rowData);
      }

      return preview;
    } catch (error) {
      this.logger.error(`Failed to preview Excel file: ${error.message}`);
      throw error;
    }
  }

  async getExcelFilesList() {
    try {
      const files = fs.readdirSync(this.excelDir);
      const excelFiles = files.filter(file => 
        (file.endsWith('.xlsx') || file.endsWith('.xls')) && 
        !file.startsWith('~$') // Ignore temporary Excel owner files
      );

      const fileList = [];
      for (const file of excelFiles) {
        const filePath = path.join(this.excelDir, file);
        const stats = fs.statSync(filePath);
        const processed = this.processedFiles.has(file);
        const storedInfo = this.processedFiles.get(file);
        const currentHash = this.computeFileHash(filePath);
        fileList.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          processed: processed && storedInfo && storedInfo.hash === currentHash,
          changed: processed && storedInfo && storedInfo.hash !== currentHash,
          isValid: await this.validateExcelFile(filePath).then(result => result.valid).catch(() => false)
        });
      }

      return fileList.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      this.logger.error('Failed to get Excel files list:', error);
      throw error;
    }
  }

  async moveFileToProcessed(fileName) {
    const filePath = path.join(this.excelDir, fileName);
    const processedPath = filePath + '.processed';

    try {
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, processedPath);
        this.logger.info(`Moved ${fileName} to processed`);
        return true;
      }
    } catch (error) {
      this.logger.error(`Failed to move ${fileName} to processed:`, error);
    }
    return false;
  }

  async moveFileToBackup(fileName) {
    const backupDir = path.join(this.dataDir, 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filePath = path.join(this.excelDir, fileName);
    const backupPath = path.join(backupDir, fileName);

    try {
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, backupPath);
        this.logger.info(`Moved ${fileName} to backup`);
        return true;
      }
    } catch (error) {
      this.logger.error(`Failed to move ${fileName} to backup:`, error);
    }
    return false;
  }
}

module.exports = { ExcelReaderService };