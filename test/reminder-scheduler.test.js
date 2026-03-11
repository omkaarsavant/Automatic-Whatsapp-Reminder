const { ReminderScheduler } = require('../src/reminder-scheduler');
const { Logger } = require('../src/logger');
const { Database } = require('../src/database');
const { WhatsAppService } = require('../src/whatsapp-service');
const { ExcelReaderService } = require('../src/excel-reader');

jest.mock('../src/logger');
jest.mock('../src/database');
jest.mock('../src/whatsapp-service');
jest.mock('../src/excel-reader');

const cron = require('node-cron');

describe('ReminderScheduler', () => {
  let reminderScheduler;
  let logger;
  let database;
  let whatsappService;
  let excelReader;

  beforeEach(() => {
    logger = new Logger();
    database = new Database(logger);
    whatsappService = new WhatsAppService(logger, database);
    excelReader = new ExcelReaderService(logger, database);
    reminderScheduler = new ReminderScheduler(
      logger,
      database,
      whatsappService,
      excelReader
    );
  });

  describe('Initialization', () => {
    it('should initialize reminder scheduler', async () => {
      const setupScheduleSpy = jest.spyOn(reminderScheduler, 'setupSchedule').mockResolvedValue();

      await reminderScheduler.init();

      expect(setupScheduleSpy).toHaveBeenCalled();
    });

    it('should set up scheduled tasks', async () => {
      const setupScheduleSpy = jest.spyOn(reminderScheduler, 'setupSchedule');

      await reminderScheduler.init();

      expect(setupScheduleSpy).toHaveBeenCalled();
      expect(reminderScheduler.scheduledTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Hourly Check', () => {
    it('should process hourly check', async () => {
      const excelReaderSpy = jest.spyOn(excelReader, 'processExcelFiles').mockResolvedValue();
      const sendRemindersSpy = jest.spyOn(reminderScheduler, 'sendPendingReminders').mockResolvedValue();

      await reminderScheduler.processHourlyCheck();

      expect(excelReaderSpy).toHaveBeenCalled();
      expect(sendRemindersSpy).toHaveBeenCalled();
    });

    it('should prevent concurrent hourly checks', async () => {
      reminderScheduler.isRunning = true;

      const excelReaderSpy = jest.spyOn(excelReader, 'processExcelFiles');
      const sendRemindersSpy = jest.spyOn(reminderScheduler, 'sendPendingReminders');

      await reminderScheduler.processHourlyCheck();

      expect(excelReaderSpy).not.toHaveBeenCalled();
      expect(sendRemindersSpy).not.toHaveBeenCalled();
    });
  });

  describe('Reminder Sending', () => {
    it('should send pending reminders', async () => {
      const whatsappServiceSpy = jest.spyOn(whatsappService, 'checkConnection').mockResolvedValue(true);
      const excelReaderSpy = jest.spyOn(excelReader, 'getPendingReminders').mockResolvedValue([
        {
          policy_number: 'LIC123',
          phone_number: '9876543210',
          reminder_type: 'today'
        }
      ]);
      const sendReminderSpy = jest.spyOn(reminderScheduler, 'sendReminder').mockResolvedValue();
      const markProcessedSpy = jest.spyOn(excelReader, 'markRecordProcessed').mockResolvedValue();

      await reminderScheduler.sendPendingReminders();

      expect(whatsappServiceSpy).toHaveBeenCalled();
      expect(excelReaderSpy).toHaveBeenCalled();
      expect(sendReminderSpy).toHaveBeenCalled();
      expect(markProcessedSpy).toHaveBeenCalled();
    });

    it('should handle reminder sending errors', async () => {
      const whatsappServiceSpy = jest.spyOn(whatsappService, 'checkConnection').mockResolvedValue(true);
      const excelReaderSpy = jest.spyOn(excelReader, 'getPendingReminders').mockResolvedValue([
        {
          policy_number: 'LIC123',
          phone_number: '9876543210',
          reminder_type: 'today'
        }
      ]);
      const sendReminderSpy = jest.spyOn(reminderScheduler, 'sendReminder').mockRejectedValue(new Error('Send failed'));

      await reminderScheduler.sendPendingReminders();

      expect(whatsappServiceSpy).toHaveBeenCalled();
      expect(excelReaderSpy).toHaveBeenCalled();
      expect(sendReminderSpy).toHaveBeenCalled();
    });
  });

  describe('Message Creation', () => {
    it('should create today reminder message', () => {
      const today = new Date();
      const record = {
        customer_name: 'John Doe',
        premium_amount: 5000,
        due_date: today,
        policy_number: 'LIC123',
        policy_type: 'Endowment',
        premium_frequency: 'Monthly',
        reminder_type: 'today'
      };

      const message = reminderScheduler.createReminderMessage(record);

      expect(message).toContain('This is a friendly reminder that your LIC premium of ₹5000 is due today');
      expect(message).toContain('Policy Number: LIC123');
      expect(message).toContain('Policy Type: Endowment');
      expect(message).toContain('Premium Frequency: Monthly');
    });

    it('should create one day before reminder message', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const record = {
        customer_name: 'John Doe',
        premium_amount: 5000,
        due_date: tomorrow,
        policy_number: 'LIC123',
        policy_type: 'Endowment',
        premium_frequency: 'Monthly',
        reminder_type: 'one_day_before'
      };

      const message = reminderScheduler.createReminderMessage(record);

      expect(message).toContain('Friendly reminder: Your LIC premium of ₹5000 is due tomorrow');
    });

    it('should create seven days before reminder message', () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const record = {
        customer_name: 'John Doe',
        premium_amount: 5000,
        due_date: nextWeek,
        policy_number: 'LIC123',
        policy_type: 'Endowment',
        premium_frequency: 'Monthly',
        reminder_type: 'seven_days_before'
      };

      const message = reminderScheduler.createReminderMessage(record);

      expect(message).toContain('Advance notice: Your LIC premium of ₹5000 is due on');
      expect(message).toContain('days from now');
    });
  });

  describe('Cleanup', () => {
    it('should perform daily cleanup', async () => {
      const excelReaderSpy = jest.spyOn(excelReader, 'cleanupOldFiles').mockResolvedValue();
      const databaseSpy = jest.spyOn(database, 'cleanupOldLogs').mockResolvedValue();

      await reminderScheduler.cleanupOldFiles();

      expect(excelReaderSpy).toHaveBeenCalledWith(30);
      expect(databaseSpy).toHaveBeenCalledWith(90);
    });
  });

  describe('Weekly Stats', () => {
    it('should send weekly stats', async () => {
      const excelReaderSpy = jest.spyOn(excelReader, 'getRecordStats').mockResolvedValue({
        totalRecords: 100,
        activePolicies: 50,
        remindersSent: 75,
        successfulDeliveries: 70,
        failedAttempts: 5,
        upcomingPremiums: 20,
        pendingReminders: 10,
        uptime: 168,
        avgProcessingTime: 50
      });
      const whatsappServiceSpy = jest.spyOn(whatsappService, 'sendMessage').mockResolvedValue();

      await reminderScheduler.sendWeeklyStats();

      expect(excelReaderSpy).toHaveBeenCalled();
      expect(whatsappServiceSpy).toHaveBeenCalled();
    });
  });

  describe('System Status', () => {
    it('should get system status', async () => {
      const getSystemStatusSpy = jest.spyOn(reminderScheduler, 'getSystemStatus');

      const status = await reminderScheduler.getSystemStatus();

      expect(getSystemStatusSpy).toHaveBeenCalled();
      expect(status).toHaveProperty('systemStatus');
      expect(status).toHaveProperty('lastCheck');
      expect(status).toHaveProperty('pendingReminders');
    });
  });

  describe('Task Management', () => {
    it('should add custom task', async () => {
      const addCustomTaskSpy = jest.spyOn(reminderScheduler, 'addCustomTask');

      const result = await reminderScheduler.addCustomTask('0 12 * * *', 'daily-report', async () => {}, 'Daily report task');

      expect(addCustomTaskSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should remove task', async () => {
      const removeTaskSpy = jest.spyOn(reminderScheduler, 'removeTask');

      const result = await reminderScheduler.removeTask('hourly-check');

      expect(removeTaskSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});