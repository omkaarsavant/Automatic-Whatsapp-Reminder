const path = require('path');
const { WhatsAppService } = require('./whatsapp-service');
const { ExcelReaderService } = require('./excel-reader');
const { ReminderScheduler } = require('./reminder-scheduler');
const { Database } = require('./database');
const { Logger } = require('./logger');
const config = require('../config.json');

class WhatsAppReminderSystem {
  constructor() {
    this.logger = new Logger();
    this.database = new Database(this.logger);
    this.whatsappService = new WhatsAppService(this.logger, this.database);
    this.excelReader = new ExcelReaderService(this.logger, this.database);
    this.reminderScheduler = new ReminderScheduler(
      this.logger,
      this.database,
      this.whatsappService,
      this.excelReader
    );
  }

  async init() {
    try {
      this.logger.info('Initializing WhatsApp Reminder System...');

      await this.database.init();
      await this.whatsappService.init();
      await this.excelReader.init();
      await this.reminderScheduler.init();

      this.logger.info('System initialized successfully');

      process.on('SIGINT', async () => {
        this.logger.info('Shutting down gracefully...');
        await this.reminderScheduler.stop();
        await this.whatsappService.disconnect();
        await this.database.close();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        this.logger.info('Received SIGTERM, shutting down gracefully...');
        await this.reminderScheduler.stop();
        await this.whatsappService.disconnect();
        await this.database.close();
        process.exit(0);
      });

      process.on('uncaughtException', (error) => {
        this.logger.error('Uncaught exception:', error);
        process.exit(1);
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      });

    } catch (error) {
      this.logger.error('Failed to initialize system:', error);
      process.exit(1);
    }
  }

  async start() {
    try {
      this.logger.info('Starting WhatsApp Reminder System...');

      // Initialize services sequentially (order matters: db first)
      await this.database.init();
      await this.whatsappService.init();
      await this.excelReader.init();
      await this.reminderScheduler.init();

      this.logger.info('All services started successfully');

      // Health check endpoint (if needed)
      this.setupHealthChecks();

      // Start PM2 monitoring
      this.setupPM2Monitoring();

    } catch (error) {
      this.logger.error('Failed to start system:', error);
      process.exit(1);
    }
  }

  setupHealthChecks() {
    if (require.main === module) {
      const express = require('express');
      const app = express();
      const port = process.env.PORT || 3000;

      app.use(express.json());

      // Serve dashboard static files
      const publicDir = path.join(__dirname, '../public');
      app.use(express.static(publicDir));

      app.get('/health', async (req, res) => {
        try {
          const status = await this.reminderScheduler.getSystemStatus();
          res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            data: status
          });
        } catch (error) {
          res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
          });
        }
      });

      app.get('/metrics', async (req, res) => {
        try {
          const stats = await this.excelReader.getRecordStats();
          const rateLimitStatus = await this.whatsappService.rateLimiter.getGlobalStats();

          res.json({
            timestamp: new Date().toISOString(),
            metrics: {
              records: stats,
              rate_limit: rateLimitStatus,
              uptime: await this.database.getConfig('system.uptime') || 0
            }
          });
        } catch (error) {
          res.status(500).json({
            error: error.message
          });
        }
      });

      app.get('/logs', async (req, res) => {
        try {
          const level = req.query.level || 'info';
          const limit = parseInt(req.query.limit) || 50;
          const logs = await this.database.getLogs(level, limit);

          res.json({
            timestamp: new Date().toISOString(),
            logs: logs
          });
        } catch (error) {
          res.status(500).json({
            error: error.message
          });
        }
      });

      app.post('/config', async (req, res) => {
        try {
          const { key, value } = req.body;
          if (!key || value === undefined) {
            return res.status(400).json({ error: 'Key and value are required' });
          }

          await this.database.setConfig(key, value);
          res.json({ success: true, key, value });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/config/:key', async (req, res) => {
        try {
          const { key } = req.params;
          const value = await this.database.getConfig(key);

          if (value === null) {
            return res.status(404).json({ error: 'Config key not found' });
          }

          res.json({ key, value });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/status', async (req, res) => {
        try {
          const status = await this.reminderScheduler.getSystemStatus();
          const config = await this.database.getSystemConfig();

          res.json({
            system: 'WhatsApp Reminder System',
            status: 'running',
            timestamp: new Date().toISOString(),
            version: config['system.version'] || '1.0.0',
            data: status
          });
        } catch (error) {
          res.status(503).json({
            system: 'WhatsApp Reminder System',
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
          });
        }
      });

      app.get('/trigger', async (req, res) => {
        try {
          this.logger.info('Manual trigger received - processing Excel files and sending reminders...');
          await this.reminderScheduler.processHourlyCheck();
          const stats = await this.database.getRecordStats();
          res.json({
            status: 'completed',
            timestamp: new Date().toISOString(),
            message: 'Hourly check triggered successfully',
            stats: {
              totalRecords: stats.totalRecords,
              pendingReminders: stats.pendingReminders,
              remindersSent: stats.remindersSent
            }
          });
        } catch (error) {
          res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
          });
        }
      });

      // Immediate trigger - send reminders NOW regardless of schedule
      app.post('/trigger-immediate', async (req, res) => {
        try {
          const { policyNumbers } = req.body || {};
          this.logger.info(`Immediate trigger received${policyNumbers ? ` for ${policyNumbers.length} policies` : ' for all policies'}...`);
          const result = await this.reminderScheduler.sendImmediateReminders(policyNumbers || null);
          res.json({
            status: 'completed',
            timestamp: new Date().toISOString(),
            message: 'Immediate reminders sent',
            result
          });
        } catch (error) {
          res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
          });
        }
      });

      // Dashboard API - aggregate data
      app.get('/api/dashboard', async (req, res) => {
        try {
          const [stats, remindersByType, dailyVolume, upcoming, recentReminders, filesList, systemStatus, pendingQueue] = await Promise.all([
            this.database.getRecordStats(),
            this.database.getRemindersByType(),
            this.database.getDailySendVolume(30),
            this.database.getUpcomingRecords(30),
            this.database.getRecentSentReminders(20),
            this.excelReader.getExcelFilesList(),
            this.reminderScheduler.getSystemStatus(),
            this.excelReader.getPendingReminders()
          ]);

          res.json({
            timestamp: new Date().toISOString(),
            stats,
            remindersByType,
            dailyVolume,
            upcoming,
            recentReminders,
            filesList,
            systemStatus,
            pendingQueue
          });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/reminders/recent', async (req, res) => {
        try {
          const limit = parseInt(req.query.limit) || 50;
          const reminders = await this.database.getRecentSentReminders(limit);
          res.json({ reminders });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.get('/api/records/upcoming', async (req, res) => {
        try {
          const days = parseInt(req.query.days) || 30;
          const records = await this.database.getUpcomingRecords(days);
          res.json({ records });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      app.listen(port, () => {
        this.logger.info(`Health check server running on port ${port}`);
        this.logger.info(`Dashboard available at http://localhost:${port}/`);
      });
    }
  }

  setupPM2Monitoring() {
    if (require.main === module && process.env.NODE_ENV === 'production') {
      const pm2 = require('pm2');

      pm2.connect((err) => {
        if (err) {
          this.logger.error('PM2 connection failed:', err);
          return;
        }

        pm2.launchBus((err, bus) => {
          if (err) {
            this.logger.error('PM2 bus launch failed:', err);
            return;
          }

          bus.on('process:exception', (data) => {
            this.logger.error('PM2 process exception:', data.data);
          });

          bus.on('process:event', (data) => {
            if (data.event === 'exit') {
              this.logger.info(`Process ${data.process.name} exited`);
            }
          });
        });
      });
    }
  }

  async gracefulShutdown() {
    this.logger.info('Initiating graceful shutdown...');

    try {
      await Promise.all([
        this.reminderScheduler.stop(),
        this.whatsappService.disconnect(),
        this.database.close()
      ]);

      this.logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  async restartServices() {
    this.logger.info('Restarting all services...');

    try {
      await Promise.all([
        this.reminderScheduler.stop(),
        this.whatsappService.disconnect(),
        this.database.close()
      ]);

      await Promise.all([
        this.database.init(),
        this.whatsappService.init(),
        this.reminderScheduler.init()
      ]);

      this.logger.info('All services restarted successfully');
    } catch (error) {
      this.logger.error('Failed to restart services:', error);
      throw error;
    }
  }

  async getSystemInfo() {
    const status = await this.reminderScheduler.getSystemStatus();
    const config = await this.database.getSystemConfig();
    const rateLimitStatus = await this.whatsappService.rateLimiter.getGlobalStats();

    return {
      system: 'WhatsApp Reminder System',
      version: config['system.version'] || '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
      data: {
        ...status,
        rateLimit: rateLimitStatus,
        config: {
          environment: process.env.NODE_ENV || 'development',
          logLevel: process.env.LOG_LEVEL || 'info'
        }
      }
    };
  }
}

// If this module is the main module, start the system
if (require.main === module) {
  const system = new WhatsAppReminderSystem();
  system.start();
}

module.exports = { WhatsAppReminderSystem };