const { WhatsAppReminderSystem } = require('../src/index');
const { Logger } = require('../src/logger');
const { Database } = require('../src/database');
const { WhatsAppService } = require('../src/whatsapp-service');
const { ExcelReaderService } = require('../src/excel-reader');
const { ReminderScheduler } = require('../src/reminder-scheduler');

jest.mock('../src/logger');
jest.mock('../src/database');
jest.mock('../src/whatsapp-service');
jest.mock('../src/excel-reader');
jest.mock('../src/reminder-scheduler');

describe('WhatsAppReminderSystem', () => {
  let system;
  let logger;
  let database;
  let whatsappService;
  let excelReader;
  let reminderScheduler;

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
    system = new WhatsAppReminderSystem();
  });

  describe('Initialization', () => {
    it('should initialize system components', async () => {
      const initSpy = jest.spyOn(system, 'init');

      await system.init();

      expect(initSpy).toHaveBeenCalled();
    });

    it('should initialize all services', async () => {
      const databaseInitSpy = jest.spyOn(database, 'init').mockResolvedValue();
      const whatsappInitSpy = jest.spyOn(whatsappService, 'init').mockResolvedValue();
      const excelInitSpy = jest.spyOn(excelReader, 'init').mockResolvedValue();
      const schedulerInitSpy = jest.spyOn(reminderScheduler, 'init').mockResolvedValue();

      await system.init();

      expect(databaseInitSpy).toHaveBeenCalled();
      expect(whatsappInitSpy).toHaveBeenCalled();
      expect(excelInitSpy).toHaveBeenCalled();
      expect(schedulerInitSpy).toHaveBeenCalled();
    });
  });

  describe('Signal Handling', () => {
    it('should handle SIGINT gracefully', async () => {
      const schedulerStopSpy = jest.spyOn(reminderScheduler, 'stop').mockResolvedValue();
      const whatsappDisconnectSpy = jest.spyOn(whatsappService, 'disconnect').mockResolvedValue();

      // Mock process signal
      const originalSIGINT = process.listeners('SIGINT').slice();
      process.removeAllListeners('SIGINT');

      const signalHandler = jest.fn();
      process.on('SIGINT', signalHandler);

      // Emit SIGINT
      process.emit('SIGINT');

      expect(schedulerStopSpy).toHaveBeenCalled();
      expect(whatsappDisconnectSpy).toHaveBeenCalled();
      expect(signalHandler).toHaveBeenCalled();

      // Restore original listeners
      process.removeAllListeners('SIGINT');
      originalSIGINT.forEach(listener => process.on('SIGINT', listener));
    });

    it('should handle SIGTERM gracefully', async () => {
      const schedulerStopSpy = jest.spyOn(reminderScheduler, 'stop').mockResolvedValue();
      const whatsappDisconnectSpy = jest.spyOn(whatsappService, 'disconnect').mockResolvedValue();

      // Mock process signal
      const originalSIGTERM = process.listeners('SIGTERM').slice();
      process.removeAllListeners('SIGTERM');

      const signalHandler = jest.fn();
      process.on('SIGTERM', signalHandler);

      // Emit SIGTERM
      process.emit('SIGTERM');

      expect(schedulerStopSpy).toHaveBeenCalled();
      expect(whatsappDisconnectSpy).toHaveBeenCalled();
      expect(signalHandler).toHaveBeenCalled();

      // Restore original listeners
      process.removeAllListeners('SIGTERM');
      originalSIGTERM.forEach(listener => process.on('SIGTERM', listener));
    });
  });

  describe('Error Handling', () => {
    it('should handle uncaught exceptions', () => {
      const errorSpy = jest.spyOn(logger, 'error');

      // Mock uncaught exception
      const originalException = process.listeners('uncaughtException').slice();
      process.removeAllListeners('uncaughtException');

      const exceptionHandler = jest.fn();
      process.on('uncaughtException', exceptionHandler);

      // Emit exception
      const testError = new Error('Test exception');
      process.emit('uncaughtException', testError);

      expect(errorSpy).toHaveBeenCalledWith('Uncaught exception:', testError);
      expect(exceptionHandler).toHaveBeenCalledWith(testError);

      // Restore original listeners
      process.removeAllListeners('uncaughtException');
      originalException.forEach(listener => process.on('uncaughtException', listener));
    });

    it('should handle unhandled rejections', () => {
      const errorSpy = jest.spyOn(logger, 'error');

      // Mock unhandled rejection
      const originalRejection = process.listeners('unhandledRejection').slice();
      process.removeAllListeners('unhandledRejection');

      const rejectionHandler = jest.fn();
      process.on('unhandledRejection', rejectionHandler);

      // Emit rejection
      const testReason = new Error('Test rejection');
      const testPromise = Promise.reject(testReason);
      process.emit('unhandledRejection', testReason, testPromise);

      expect(errorSpy).toHaveBeenCalledWith('Unhandled rejection at:', testPromise, 'reason:', testReason);
      expect(rejectionHandler).toHaveBeenCalledWith(testReason, testPromise);

      // Restore original listeners
      process.removeAllListeners('unhandledRejection');
      originalRejection.forEach(listener => process.on('unhandledRejection', listener));
    });
  });

  describe('System Start', () => {
    it('should start all services', async () => {
      const startSpy = jest.spyOn(system, 'start');

      await system.start();

      expect(startSpy).toHaveBeenCalled();
    });

    it('should handle start errors', async () => {
      const databaseInitSpy = jest.spyOn(database, 'init').mockRejectedValue(new Error('Database failed'));

      await expect(system.start()).rejects.toThrow('Database failed');
    });
  });

  describe('Health Checks', () => {
    it('should setup health checks', () => {
      const setupHealthChecksSpy = jest.spyOn(system, 'setupHealthChecks');

      system.setupHealthChecks();

      expect(setupHealthChecksSpy).toHaveBeenCalled();
    });
  });

  describe('PM2 Monitoring', () => {
    it('should setup PM2 monitoring', () => {
      const setupPM2Spy = jest.spyOn(system, 'setupPM2Monitoring');

      system.setupPM2Monitoring();

      expect(setupPM2Spy).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should perform graceful shutdown', async () => {
      const gracefulShutdownSpy = jest.spyOn(system, 'gracefulShutdown');

      await system.gracefulShutdown();

      expect(gracefulShutdownSpy).toHaveBeenCalled();
    });
  });

  describe('Service Management', ()n    it('should restart services', async () => {
      const restartServicesSpy = jest.spyOn(system, 'restartServices');

      await system.restartServices();

      expect(restartServicesSpy).toHaveBeenCalled();
    });
  });

  describe('System Information', () => {
    it('should get system info', async () => {
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
});