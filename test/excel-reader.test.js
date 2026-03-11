const { ExcelReaderService } = require('../src/excel-reader');
const { Logger } = require('../src/logger');
const { Database } = require('../src/database');
const { RateLimiter } = require('../src/rate-limiter');

jest.mock('../src/logger');
jest.mock('../src/database');
jest.mock('../src/rate-limiter');

describe('ExcelReaderService', () => {
  let excelReader;
  let logger;
  let database;
  let rateLimiter;

  beforeEach(() => {
    logger = new Logger();
    database = new Database(logger);
    rateLimiter = new RateLimiter(logger);
    excelReader = new ExcelReaderService(logger, database);
  });

  describe('Initialization', () => {
    it('should initialize Excel reader service', async () => {
      const setupDirectoriesSpy = jest.spyOn(excelReader, 'setupDirectories').mockResolvedValue();
      const loadProcessedFilesSpy = jest.spyOn(excelReader, 'loadProcessedFiles').mockResolvedValue();

      await excelReader.init();

      expect(setupDirectoriesSpy).toHaveBeenCalled();
      expect(loadProcessedFilesSpy).toHaveBeenCalled();
    });

    it('should create required directories', async () => {
      const fs = require('fs');
      const path = require('path');

      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs, 'mkdirSync').mockImplementation();

      await excelReader.setupDirectories();

      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(__dirname, '../data'), { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(__dirname, '../data/excel'), { recursive: true });
    });
  });

  describe('File Processing', () => {
    it('should process Excel files', async () => {
      const fs = require('fs');
      const path = require('path');

      // Mock directory structure
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['file1.xlsx', 'file2.xls']);
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      // Mock file processing
      const processSingleFileSpy = jest.spyOn(excelReader, 'processSingleFile').mockResolvedValue();

      await excelReader.processExcelFiles();

      expect(processSingleFileSpy).toHaveBeenCalledTimes(2);
      expect(processSingleFileSpy).toHaveBeenCalledWith('file1.xlsx');
      expect(processSingleFileSpy).toHaveBeenCalledWith('file2.xls');
    });

    it('should skip already processed files', async () => {
      const fs = require('fs');
      const path = require('path');

      // Mock directory structure
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['file1.xlsx', 'file2.xls']);
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      // Mock processed files
      excelReader.processedFiles = new Set(['file1.xlsx']);

      // Mock file processing
      const processSingleFileSpy = jest.spyOn(excelReader, 'processSingleFile').mockResolvedValue();

      await excelReader.processExcelFiles();

      expect(processSingleFileSpy).toHaveBeenCalledTimes(1);
      expect(processSingleFileSpy).toHaveBeenCalledWith('file2.xls');
    });
  });

  describe('File Validation', () => {
    it('should validate Excel file structure', async () => {
      const ExcelJS = require('exceljs');
      const fs = require('fs');
      const path = require('path');

      // Mock valid Excel file
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Premiums');
      worksheet.columns = [
        { header: 'Policy Number', key: 'policy_number' },
        { header: 'Customer Name', key: 'customer_name' },
        { header: 'Phone Number', key: 'phone_number' },
        { header: 'Premium Amount', key: 'premium_amount' },
        { header: 'Due Date', key: 'due_date' }
      ];

      const mockReadFile = jest.fn().mockResolvedValue(workbook);
      jest.spyOn(ExcelJS.Workbook.prototype, 'xlsx', 'get').mockReturnValue({ readFile: mockReadFile });

      const result = await excelReader.validateExcelFile('test.xlsx');

      expect(result.valid).toBe(true);
      expect(result.headers).toEqual({
        1: 'policy_number',
        2: 'customer_name',
        3: 'phone_number',
        4: 'premium_amount',
        5: 'due_date'
      });
    });

    it('should detect missing required headers', async () => {
      const ExcelJS = require('exceljs');
      const fs = require('fs');
      const path = require('path');

      // Mock Excel file missing required headers
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Premiums');
      worksheet.columns = [
        { header: 'Policy Number', key: 'policy_number' },
        { header: 'Customer Name', key: 'customer_name' },
        { header: 'Phone Number', key: 'phone_number' }
      ];

      const mockReadFile = jest.fn().mockResolvedValue(workbook);
      jest.spyOn(ExcelJS.Workbook.prototype, 'xlsx', 'get').mockReturnValue({ readFile: mockReadFile });

      const result = await excelReader.validateExcelFile('test.xlsx');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing required header');
    });
  });

  describe('Data Parsing', () => {
    it('should parse valid row correctly', () => {
      const ExcelJS = require('exceljs');
      const fs = require('fs');
      const path = require('path');

      const headers = {
        1: 'policy_number',
        2: 'customer_name',
        3: 'phone_number',
        4: 'premium_amount',
        5: 'due_date'
      };

      const row = new ExcelJS.Row();
      row.values = [
        'LIC12345678',
        'John Doe',
        '9876543210',
        '5000',
        '15/03/2026'
      ];

      const record = excelReader.parseRow(row, headers);

      expect(record).toEqual({
        policy_number: 'LIC12345678',
        customer_name: 'John Doe',
        phone_number: '9876543210',
        premium_amount: 5000,
        due_date: expect.any(Date),
        policy_status: '',
        email: '',
        policy_type: '',
        premium_frequency: '',
        last_payment_date: null,
        next_due_date: null
      });

      expect(record.due_date).toBeDefined();
    });

    it('should validate phone number format', () => {
      expect(excelReader.validateRecord({
        phone_number: '9876543210',
        due_date: new Date()
      })).toBe(true);

      expect(excelReader.validateRecord({
        phone_number: '1234567890',
        due_date: new Date()
      })).toBe(false);

      expect(excelReader.validateRecord({
        phone_number: '98765432101',
        due_date: new Date()
      })).toBe(false);
    });

    it('should validate email format', () => {
      expect(excelReader.validateRecord({
        phone_number: '9876543210',
        due_date: new Date(),
        email: 'test@example.com'
      })).toBe(true);

      expect(excelReader.validateRecord({
        phone_number: '9876543210',
        due_date: new Date(),
        email: 'invalid-email'
      })).toBe(false);
    });
  });

  describe('Reminder Logic', () => {
    it('should identify today reminders', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneDayBefore = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysBefore = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const record = {
        due_date: today,
        policy_number: 'LIC123',
        customer_name: 'Test',
        phone_number: '9876543210',
        premium_amount: 1000
      };

      expect(excelReader.shouldSendReminder(record, today, oneDayBefore, sevenDaysBefore)).toBe(true);
      expect(excelReader.getReminderType(record, today, oneDayBefore, sevenDaysBefore)).toBe('today');
    });

    it('should identify one day before reminders', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneDayBefore = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysBefore = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const record = {
        due_date: oneDayBefore,
        policy_number: 'LIC123',
        customer_name: 'Test',
        phone_number: '9876543210',
        premium_amount: 1000
      };

      expect(excelReader.shouldSendReminder(record, today, oneDayBefore, sevenDaysBefore)).toBe(true);
      expect(excelReader.getReminderType(record, today, oneDayBefore, sevenDaysBefore)).toBe('one_day_before');
    });

    it('should identify seven days before reminders', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneDayBefore = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysBefore = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const record = {
        due_date: sevenDaysBefore,
        policy_number: 'LIC123',
        customer_name: 'Test',
        phone_number: '9876543210',
        premium_amount: 1000
      };

      expect(excelReader.shouldSendReminder(record, today, oneDayBefore, sevenDaysBefore)).toBe(true);
      expect(excelReader.getReminderType(record, today, oneDayBefore, sevenDaysBefore)).toBe('seven_days_before');
    });

    it('should not send reminders for past due dates', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oneDayBefore = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysBefore = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const record = {
        due_date: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        policy_number: 'LIC123',
        customer_name: 'Test',
        phone_number: '9876543210',
        premium_amount: 1000
      };

      expect(excelReader.shouldSendReminder(record, today, oneDayBefore, sevenDaysBefore)).toBe(false);
    });
  });

  describe('File Management', () => {
    it('should move file to processed', () => {
      const fs = require('fs');
      const path = require('path');

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'renameSync').mockImplementation();

      const result = excelReader.moveFileToProcessed('test.xlsx');

      expect(fs.renameSync).toHaveBeenCalledWith(
        path.join(__dirname, '../data/excel/test.xlsx'),
        path.join(__dirname, '../data/excel/test.xlsx.processed')
      );
      expect(result).toBe(true);
    });

    it('should handle file move errors', () => {
      const fs = require('fs');
      const path = require('path');

      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      jest.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('Move failed');
      });

      const result = excelReader.moveFileToProcessed('test.xlsx');

      expect(result).toBe(false);
    });
  });
});