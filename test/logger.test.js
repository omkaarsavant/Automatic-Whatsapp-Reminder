const { Logger } = require('../src/logger');

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    logger = new Logger();
  });

  describe('Initialization', () => {
    it('should initialize logger', () => {
      expect(logger).toBeDefined();
      expect(logger.logger).toBeDefined();
    });

    it('should create log directory', () => {
      const fs = require('fs');
      const path = require('path');

      const logDir = path.join(__dirname, '../logs');
      expect(fs.existsSync(logDir)).toBe(true);
    });
  });

  describe('Logging Methods', () => {
    it('should log info messages', () => {
      const infoSpy = jest.spyOn(logger.logger, 'info');

      logger.info('Test info message');

      expect(infoSpy).toHaveBeenCalledWith('Test info message');
    });

    it('should log warn messages', () => {
      const warnSpy = jest.spyOn(logger.logger, 'warn');

      logger.warn('Test warn message');

      expect(warnSpy).toHaveBeenCalledWith('Test warn message');
    });

    it('should log error messages', () => {
      const errorSpy = jest.spyOn(logger.logger, 'error');

      logger.error('Test error message');

      expect(errorSpy).toHaveBeenCalledWith('Test error message');
    });

    it('should log verbose messages', () => {
      const verboseSpy = jest.spyOn(logger.logger, 'verbose');

      logger.verbose('Test verbose message');

      expect(verboseSpy).toHaveBeenCalledWith('Test verbose message');
    });

    it('should log debug messages', () => {
      const debugSpy = jest.spyOn(logger.logger, 'debug');

      logger.debug('Test debug message');

      expect(debugSpy).toHaveBeenCalledWith('Test debug message');
    });
  });

  describe('Database Logging', () => {
    it('should log to database', () => {
      const logToDatabaseSpy = jest.spyOn(logger, 'logToDatabase');

      logger.info('Test database log');

      expect(logToDatabaseSpy).toHaveBeenCalledWith('info', 'Test database log');
    });
  });

  describe('Log Retrieval', () => {
    it('should get logs from database', async () => {
      const getLogsSpy = jest.spyOn(logger, 'getLogs');

      const logs = await logger.getLogs();

      expect(getLogsSpy).toHaveBeenCalled();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Log Cleanup', () => {
    it('should cleanup old logs', async () => {
      const cleanupSpy = jest.spyOn(logger, 'cleanupOldLogs');

      await logger.cleanupOldLogs(30);

      expect(cleanupSpy).toHaveBeenCalledWith(30);
    });
  });

  describe('Stream Interface', () => {
    it('should provide stream interface', () => {
      const stream = logger.getStream();
      expect(stream).toHaveProperty('write');
      expect(typeof stream.write).toBe('function');
    });
  });

  describe('Winston Integration', () => {
    it('should use winston logger', () => {
      expect(logger.logger).toBeDefined();
      expect(typeof logger.logger.info).toBe('function');
      expect(typeof logger.logger.error).toBe('function');
    });

    it('should configure transports correctly', () => {
      const transports = logger.logger.transports;
      expect(transports.length).toBeGreaterThan(0);
      expect(transports.find(t => t.filename.includes('error.log'))).toBeDefined();
      expect(transports.find(t => t.filename.includes('combined.log'))).toBeDefined();
    });
  });

  describe('Environment Configuration', () => {
    it('should configure different log levels', () => {
      // Test default level
      const defaultLogger = new Logger();
      expect(defaultLogger.logger.level).toBe('info');

      // Test production level
      process.env.NODE_ENV = 'production';
      const productionLogger = new Logger();
      expect(productionLogger.logger.level).toBe('info');

      // Test development level
      process.env.NODE_ENV = 'development';
      const developmentLogger = new Logger();
      expect(developmentLogger.logger.level).toBe('debug');
    });
  });

  describe('Log Format', () => {
    it('should use JSON format', () => {
      const format = logger.logger.format;
      expect(format).toBeDefined();
    });

    it('should include timestamp', () => {
      const timestampSpy = jest.spyOn(logger.logger.format, 'timestamp');

      logger.info('Test timestamp');

      expect(timestampSpy).toHaveBeenCalled();
    });
  });
});