const winston = require('winston');
const path = require('path');
const fs = require('fs');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.setupLogger();
  }

  setupLogger() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'whatsapp-reminder-system' },
      transports: [
        new winston.transports.File({
          filename: path.join(this.logDir, 'error.log'),
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
          tailable: true
        }),
        new winston.transports.File({
          filename: path.join(this.logDir, 'combined.log'),
          maxsize: 10485760, // 10MB
          maxFiles: 7,
          tailable: true
        }),
        new winston.transports.File({
          filename: path.join(this.logDir, 'info.log'),
          level: 'info',
          maxsize: 10485760, // 10MB
          maxFiles: 7,
          tailable: true
        })
      ]
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }

    this.logger.info('Logger initialized successfully');
  }

  info(message, metadata = null) {
    this.logger.info(message, metadata);
    this.logToDatabase('info', message, metadata);
  }

  warn(message, metadata = null) {
    this.logger.warn(message, metadata);
    this.logToDatabase('warn', message, metadata);
  }

  error(message, metadata = null) {
    this.logger.error(message, metadata);
    this.logToDatabase('error', message, metadata);
  }

  verbose(message, metadata = null) {
    this.logger.verbose(message, metadata);
    this.logToDatabase('verbose', message, metadata);
  }

  debug(message, metadata = null) {
    this.logger.debug(message, metadata);
    this.logToDatabase('debug', message, metadata);
  }

  logToDatabase(level, message, metadata) {
    if (global.database) {
      global.database.log(level, message, metadata).catch(err => {
        console.error('Failed to log to database:', err);
      });
    }
  }

  getLogger() {
    return this.logger;
  }

  getStream() {
    return {
      write: (message) => {
        this.info(message.substring(0, message.lastIndexOf('\n')));
      }
    };
  }

  async getLogs(level = null, limit = 100) {
    if (global.database) {
      return await global.database.getLogs(level, limit);
    }
    return [];
  }

  async cleanupOldLogs(daysToKeep = 30) {
    if (global.database) {
      await global.database.cleanupOldLogs(daysToKeep);
    }
  }
}

module.exports = { Logger };