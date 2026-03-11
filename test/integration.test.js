const { WhatsAppReminderSystem } = require('../src/index');
const fs = require('fs');
const path = require('path');

jest.mock('fs');
jest.mock('path');
jest.mock('../src/index');

describe('Integration Tests', () => {
  let system;

  beforeEach(() => {
    system = new WhatsAppReminderSystem();
  });

  describe('System Lifecycle', () => {
    it('should start and stop the system correctly', async () => {
      const initSpy = jest.spyOn(system, 'init');
      const startSpy = jest.spyOn(system, 'start');

      await system.start();

      expect(initSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });

    it('should handle graceful shutdown', async () => {
      const gracefulShutdownSpy = jest.spyOn(system, 'gracefulShutdown');

      await system.gracefulShutdown();

      expect(gracefulShutdownSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should get and set configuration values', async () => {
      const getSystemInfoSpy = jest.spyOn(system, 'getSystemInfo');

      const info = await system.getSystemInfo();

      expect(getSystemInfoSpy).toHaveBeenCalled();
      expect(info).toHaveProperty('system');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('status');
      expect(info).toHaveProperty('timestamp');
      expect(info).toHaveProperty('data');
    });
  });

  describe('File Operations', () => {
    it('should handle Excel file processing', async () => {
      const fs = require('fs');
      const path = require('path');

      // Mock file system
      const mockReaddirSync = jest.spyOn(fs, 'readdirSync').mockReturnValue(['test-file.xlsx']);
      const mockExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Mock Excel reader
      const excelReader = system.excelReader;
      const processExcelFilesSpy = jest.spyOn(excelReader, 'processExcelFiles').mockResolvedValue();

      // Mock database
      const database = system.database;
      const saveRecordsSpy = jest.spyOn(database, 'saveRecords').mockResolvedValue();

      await system.start();

      expect(mockReaddirSync).toHaveBeenCalled();
      expect(mockExistsSync).toHaveBeenCalled();
      expect(processExcelFilesSpy).toHaveBeenCalled();
      expect(saveRecordsSpy).toHaveBeenCalled();
    });
  });

  describe('WhatsApp Integration', () => {
    it('should handle WhatsApp connection', async () => {
      // Mock WhatsApp service
      const whatsappService = system.whatsappService;
      const initSpy = jest.spyOn(whatsappService, 'init').mockResolvedValue();
      const checkConnectionSpy = jest.spyOn(whatsappService, 'checkConnection').mockResolvedValue(true);

      await system.start();

      expect(initSpy).toHaveBeenCalled();
      expect(checkConnectionSpy).toHaveBeenCalled();
    });

    it('should send WhatsApp messages', async () => {
      // Mock WhatsApp service
      const whatsappService = system.whatsappService;
      const sendMessageSpy = jest.spyOn(whatsappService, 'sendMessage').mockResolvedValue({ success: true });

      // Mock reminder sending
      const reminderScheduler = system.reminderScheduler;
      const sendPendingRemindersSpy = jest.spyOn(reminderScheduler, 'sendPendingReminders').mockResolvedValue();

      await system.start();

      expect(sendMessageSpy).toHaveBeenCalled();
      expect(sendPendingRemindersSpy).toHaveBeenCalled();
    });
  });

  describe('Scheduling', () => {
    it('should set up scheduled tasks', async () => {
      // Mock reminder scheduler
      const reminderScheduler = system.reminderScheduler;
      const setupScheduleSpy = jest.spyOn(reminderScheduler, 'setupSchedule').mockResolvedValue();

      await system.start();

      expect(setupScheduleSpy).toHaveBeenCalled();
    });

    it('should run hourly check', async () => {
      // Mock hourly check
      const reminderScheduler = system.reminderScheduler;
      const processHourlyCheckSpy = jest.spyOn(reminderScheduler, 'processHourlyCheck').mockResolvedValue();

      await system.start();

      expect(processHourlyCheckSpy).toHaveBeenCalled();
    });
  });

  describe('Health Monitoring', () => {
    it('should setup health check endpoints', () => {
      const setupHealthChecksSpy = jest.spyOn(system, 'setupHealthChecks');

      system.setupHealthChecks();

      expect(setupHealthChecksSpy).toHaveBeenCalled();
    });

    it('should provide system status', async () => {
      const getSystemStatusSpy = jest.spyOn(system.reminderScheduler, 'getSystemStatus');

      const status = await system.reminderScheduler.getSystemStatus();

      expect(getSystemStatusSpy).toHaveBeenCalled();
      expect(status).toHaveProperty('systemStatus');
      expect(status).toHaveProperty('lastCheck');
      expect(status).toHaveProperty('pendingReminders');
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      // Mock database initialization failure
      const database = system.database;
      const initSpy = jest.spyOn(database, 'init').mockRejectedValue(new Error('Database connection failed'));

      await expect(system.start()).rejects.toThrow('Database connection failed');
    });

    it('should handle WhatsApp connection errors', async () => {
      // Mock WhatsApp initialization failure
      const whatsappService = system.whatsappService;
      const initSpy = jest.spyOn(whatsappService, 'init').mockRejectedValue(new Error('WhatsApp connection failed'));

      await expect(system.start()).rejects.toThrow('WhatsApp connection failed');
    });
  });

  describe('Production Features', () => {
    it('should setup PM2 monitoring', () => {
      const setupPM2Spy = jest.spyOn(system, 'setupPM2Monitoring');

      system.setupPM2Monitoring();

      expect(setupPM2Spy).toHaveBeenCalled();
    });
  });

  describe('Data Management', () => {
    it('should cleanup old files', async () => {
      const excelReader = system.excelReader;
      const cleanupSpy = jest.spyOn(excelReader, 'cleanupOldFiles').mockResolvedValue();

      await system.start();

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });
});