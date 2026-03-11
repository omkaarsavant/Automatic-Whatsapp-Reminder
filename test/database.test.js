const { Database } = require('../src/database');
const { Logger } = require('../src/logger');

jest.mock('../src/logger');

describe('Database', () => {
  let database;
  let logger;

  beforeEach(() => {
    logger = new Logger();
    database = new Database(logger);
  });

  describe('Initialization', () => {
    it('should initialize database', async () => {
      const initSpy = jest.spyOn(database, 'init');

      await database.init();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should create tables', async () => {
      const createTablesSpy = jest.spyOn(database, 'createTables');

      await database.init();

      expect(createTablesSpy).toHaveBeenCalled();
    });

    it('should migrate database', async () => {
      const migrateSpy = jest.spyOn(database, 'migrateDatabase');

      await database.init();

      expect(migrateSpy).toHaveBeenCalled();
    });
  });

  describe('Record Operations', () => {
    it('should save records', async () => {
      const records = [
        {
          policy_number: 'LIC123',
          customer_name: 'John Doe',
          phone_number: '9876543210',
          premium_amount: 5000,
          due_date: new Date(),
          policy_status: 'Active'
        }
      ];

      const saveRecordsSpy = jest.spyOn(database, 'saveRecords');

      await database.saveRecords(records);

      expect(saveRecordsSpy).toHaveBeenCalledWith(records);
    });

    it('should get records for reminders', async () => {
      const getRecordsSpy = jest.spyOn(database, 'getRecordsForReminders');

      const records = await database.getRecordsForReminders();

      expect(getRecordsSpy).toHaveBeenCalled();
      expect(Array.isArray(records)).toBe(true);
    });

    it('should mark record as processed', async () => {
      const markProcessedSpy = jest.spyOn(database, 'markRecordProcessed');

      await database.markRecordProcessed('LIC123');

      expect(markProcessedSpy).toHaveBeenCalledWith('LIC123');
    });
  });

  describe('Reminder Operations', () => {
    it('should save sent reminder', async () => {
      const reminder = {
        policy_number: 'LIC123',
        phone_number: '9876543210',
        message: 'Test message',
        reminder_type: 'today'
      };

      const saveSentReminderSpy = jest.spyOn(database, 'saveSentReminder');

      await database.saveSentReminder(reminder);

      expect(saveSentReminderSpy).toHaveBeenCalledWith(reminder);
    });
  });

  describe('Logging', () => {
    it('should log messages', async () => {
      const logSpy = jest.spyOn(database, 'log');

      await database.log('info', 'Test log message');

      expect(logSpy).toHaveBeenCalledWith('info', 'Test log message');
    });
  });

  describe('Statistics', () => {
    it('should get record statistics', async () => {
      const getStatsSpy = jest.spyOn(database, 'getRecordStats');

      const stats = await database.getRecordStats();

      expect(getStatsSpy).toHaveBeenCalled();
      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('activePolicies');
      expect(stats).toHaveProperty('remindersSent');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old logs', async () => {
      const cleanupSpy = jest.spyOn(database, 'cleanupOldLogs');

      await database.cleanupOldLogs(90);

      expect(cleanupSpy).toHaveBeenCalledWith(90);
    });
  });

  describe('Configuration', () => {
    it('should get config value', async () => {
      const getConfigSpy = jest.spyOn(database, 'getConfig');

      const value = await database.getConfig('system.uptime');

      expect(getConfigSpy).toHaveBeenCalledWith('system.uptime');
      expect(value).toBeDefined();
    });

    it('should set config value', async () => {
      const setConfigSpy = jest.spyOn(database, 'setConfig');

      await database.setConfig('test.key', 'test.value');

      expect(setConfigSpy).toHaveBeenCalledWith('test.key', 'test.value');
    });
  });

  describe('WhatsApp Session', () => {
    it('should save WhatsApp session', async () => {
      const sessionData = { session: 'data' };
      const saveSessionSpy = jest.spyOn(database, 'saveWhatsAppSession');

      await database.saveWhatsAppSession(sessionData);

      expect(saveSessionSpy).toHaveBeenCalledWith(sessionData);
    });

    it('should get WhatsApp session', async () => {
      const getSessionSpy = jest.spyOn(database, 'getWhatsAppSession');

      const session = await database.getWhatsAppSession();

      expect(getSessionSpy).toHaveBeenCalled();
      expect(session).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should save rate limit log', async () => {
      const saveRateLimitSpy = jest.spyOn(database, 'saveRateLimitLog');

      await database.saveRateLimitLog('9876543210');

      expect(saveRateLimitSpy).toHaveBeenCalledWith('9876543210');
    });

    it('should get rate limit count', async () => {
      const getRateLimitCountSpy = jest.spyOn(database, 'getRateLimitCount');

      const count = await database.getRateLimitCount('9876543210');

      expect(getRateLimitCountSpy).toHaveBeenCalledWith('9876543210');
      expect(typeof count).toBe('number');
    });
  });

  describe('Data Retrieval', () => {
    it('should get all records', async () => {
      const getAllRecordsSpy = jest.spyOn(database, 'getAllRecords');

      const records = await database.getAllRecords();

      expect(getAllRecordsSpy).toHaveBeenCalled();
      expect(Array.isArray(records)).toBe(true);
    });

    it('should get record by policy number', async () => {
      const getRecordSpy = jest.spyOn(database, 'getRecordByPolicyNumber');

      const record = await database.getRecordByPolicyNumber('LIC123');

      expect(getRecordSpy).toHaveBeenCalledWith('LIC123');
      expect(record).toBeDefined();
    });
  });

  describe('System Operations', () => {
    it('should update system uptime', async () => {
      const updateUptimeSpy = jest.spyOn(database, 'updateSystemUptime');

      await database.updateSystemUptime(24);

      expect(updateUptimeSpy).toHaveBeenCalledWith(24);
    });

    it('should get sent reminders', async () => {
      const getSentRemindersSpy = jest.spyOn(database, 'getSentReminders');

      const reminders = await database.getSentReminders();

      expect(getSentRemindersSpy).toHaveBeenCalled();
      expect(Array.isArray(reminders)).toBe(true);
    });
  });

  describe('Database Operations', () => {
    it('should run SQL queries', async () => {
      const runSqlSpy = jest.spyOn(database, 'runSql');

      await database.runSql('SELECT 1');

      expect(runSqlSpy).toHaveBeenCalledWith('SELECT 1');
    });

    it('should get single SQL result', async () => {
      const getSingleSqlSpy = jest.spyOn(database, 'getSingleSql');

      const result = await database.getSingleSql('SELECT 1');

      expect(getSingleSqlSpy).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBeDefined();
    });

    it('should get all SQL results', async () => {
      const allSqlSpy = jest.spyOn(database, 'allSql');

      const results = await database.allSql('SELECT 1');

      expect(allSqlSpy).toHaveBeenCalledWith('SELECT 1');
      expect(Array.isArray(results)).toBe(true);
    });
  });
});