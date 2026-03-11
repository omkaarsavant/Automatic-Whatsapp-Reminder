const cron = require('node-cron');
const { Logger } = require('./logger');
const { Database } = require('./database');
const { WhatsAppService } = require('./whatsapp-service');
const { ExcelReaderService } = require('./excel-reader');

class ReminderScheduler {
  constructor(logger, database, whatsappService, excelReader) {
    this.logger = logger;
    this.database = database;
    this.whatsappService = whatsappService;
    this.excelReader = excelReader;
    this.scheduledTasks = [];
    this.isRunning = false;
  }

  async init() {
    try {
      await this.setupSchedule();

      // Initial check on startup
      this.logger.info('Performing initial reminder check on startup...');
      await this.sendPendingReminders();

      // Trigger a check whenever the connection is restored (e.g., coming back from offline)
      this.whatsappService.onConnectionRestored = async () => {
        this.logger.info('WhatsApp connection restored! Checking for pending reminders to catch up...');
        await this.sendPendingReminders();
      };

      // Set up auto-send on file change
      this.excelReader.onFileProcessed = async (filename) => {
        this.logger.info(`Triggering automatic reminder check for ${filename}...`);
        await this.sendPendingReminders();
      };

      this.logger.info('Reminder scheduler initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize reminder scheduler:', error);
      throw error;
    }
  }

  async setupSchedule() {
    this.logger.info('Setting up scheduled tasks...');

    this.scheduledTasks.push({
      name: 'hourly-check',
      task: cron.schedule('0 * * * *', async () => {
        await this.processHourlyCheck();
      }),
      description: 'Run every hour to check for new Excel files and send reminders'
    });

    this.scheduledTasks.push({
      name: 'cleanup',
      task: cron.schedule('0 2 * * *', async () => {
        await this.cleanupOldFiles();
      }),
      description: 'Run daily at 2 AM to clean up old processed files'
    });

    this.scheduledTasks.push({
      name: 'stats-report',
      task: cron.schedule('0 9 * * 1', async () => {
        await this.sendWeeklyStats();
      }),
      description: 'Run weekly on Monday at 9 AM to send stats report'
    });

    this.logger.info('Scheduled tasks set up successfully');
  }

  async processHourlyCheck() {
    if (this.isRunning) {
      this.logger.warn('Hourly check already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      this.logger.info('Starting hourly check...');

      await this.excelReader.processExcelFiles();
      await this.sendPendingReminders();

      this.logger.info('Hourly check completed successfully');
    } catch (error) {
      this.logger.error('Error during hourly check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async sendPendingReminders() {
    try {
      await this.whatsappService.checkConnection();

      const reminders = await this.excelReader.getPendingReminders();
      this.logger.info(`Found ${reminders.length} pending reminders`);

      for (const reminder of reminders) {
        try {
          await this.sendReminder(reminder);
          
          // Mark as fully processed ONLY if it was the final 'today' reminder
          if (reminder.reminder_type === 'today') {
            await this.database.markRecordProcessed(reminder.policy_number);
            this.logger.info(`Policy ${reminder.policy_number} fully processed after today's final reminder`);
          }
        } catch (error) {
          this.logger.error(`Failed to send reminder for policy ${reminder.policy_number}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error sending pending reminders:', error);
    }
  }

  async sendImmediateReminders(policyNumbers = null) {
    try {
      await this.whatsappService.checkConnection();

      let records;
      if (policyNumbers && policyNumbers.length > 0) {
        records = [];
        for (const pn of policyNumbers) {
          const record = await this.database.getRecordByPolicyNumber(pn);
          if (record) records.push(record);
        }
      } else {
        // Only send immediate reminders for records that are currently "upcoming" (30 days)
        // and haven't been fully processed yet.
        const allUpcoming = await this.database.getUpcomingRecords(30);
        records = allUpcoming.filter(r => !r.processed_at);
      }

      this.logger.info(`Sending immediate reminders for ${records.length} records`);
      let sent = 0;
      let failed = 0;

      for (const record of records) {
        try {
          const reminder = { ...record, reminder_type: 'immediate' };
          await this.sendReminder(reminder);
          sent++;
        } catch (error) {
          failed++;
          this.logger.error(`Failed to send immediate reminder for policy ${record.policy_number}:`, error);
        }
      }

      return { total: records.length, sent, failed };
    } catch (error) {
      this.logger.error('Error sending immediate reminders:', error);
      throw error;
    }
  }

  async sendReminder(reminder) {
    const message = this.createReminderMessage(reminder);

    this.logger.info(`Sending reminder for policy ${reminder.policy_number}: ${message.substring(0, 50)}...`);

    await this.whatsappService.sendMessage(reminder.phone_number, message);

    await this.database.saveSentReminder({
      policy_number: reminder.policy_number,
      phone_number: reminder.phone_number,
      message: message,
      reminder_type: reminder.reminder_type,
      sent_at: new Date().toISOString()
    });

    this.logger.info(`Reminder sent successfully for policy ${reminder.policy_number}`);
  }

  createReminderMessage(reminder) {
    const dueDate = new Date(reminder.due_date);
    const formattedDate = dueDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    let message = `Dear ${reminder.customer_name},

`;

    switch (reminder.reminder_type) {
      case 'today':
        message += `This is a friendly reminder that your LIC premium of ₹${reminder.premium_amount} is due today (${formattedDate}). Please make the payment at your earliest convenience.

`;
        break;
      case 'two_days_before':
        message += `Friendly reminder: Your LIC premium of ₹${reminder.premium_amount} is due in 2 days (${formattedDate}). Please ensure timely payment.

`;
        break;
      case 'five_days_before':
        message += `Advance notice: Your LIC premium of ₹${reminder.premium_amount} is due on ${formattedDate} (${this.getDaysUntil(dueDate)} days from now). Please plan your payment accordingly.

`;
        break;
      case 'immediate':
        message += `Important: This is an urgent reminder for your LIC premium of ₹${reminder.premium_amount} due on ${formattedDate}. Please make the payment at your earliest convenience.

`;
        break;
      default:
        message += `This is a reminder for your LIC premium of ₹${reminder.premium_amount} due on ${formattedDate}.

`;
    }

    message += `Policy Number: ${reminder.policy_number}
`;
    message += `Policy Type: ${reminder.policy_type}
`;
    message += `Premium Frequency: ${reminder.premium_frequency}

`;

    message += `Thank you for choosing LIC. For any queries, please contact your LIC agent or customer service.

`;
    message += `Regards,
Your LIC Premium Reminder System`;

    return message;
  }

  getDaysUntil(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  async cleanupOldFiles() {
    try {
      this.logger.info('Starting daily cleanup...');
      await this.excelReader.cleanupOldFiles(30);
      await this.database.cleanupOldLogs(90);
      this.logger.info('Daily cleanup completed successfully');
    } catch (error) {
      this.logger.error('Error during daily cleanup:', error);
    }
  }

  async sendWeeklyStats() {
    try {
      const stats = await this.excelReader.getRecordStats();
      const message = this.createWeeklyStatsMessage(stats);

      const adminNumbers = ['9876543210', '9876543211']; // Add admin WhatsApp numbers here

      for (const number of adminNumbers) {
        try {
          await this.whatsappService.sendMessage(number, message);
          this.logger.info(`Weekly stats sent to ${number}`);
        } catch (error) {
          this.logger.error(`Failed to send weekly stats to ${number}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error sending weekly stats:', error);
    }
  }

  createWeeklyStatsMessage(stats) {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    return `\n` +
      `\n` +
      `LIC Premium Reminder System - Weekly Report\n` +
      `\n` +
      `Period: ${weekAgo.toLocaleDateString()} to ${today.toLocaleDateString()}\n` +
      `\n` +
      `Total Records Processed: ${stats.totalRecords}\n` +
      `Active Policies: ${stats.activePolicies}\n` +
      `Reminders Sent: ${stats.remindersSent}\n` +
      `Successful Deliveries: ${stats.successfulDeliveries}\n` +
      `Failed Attempts: ${stats.failedAttempts}\n` +
      `\n` +
      `Pending Reminders: ${stats.pendingReminders}\n` +
      `Upcoming Premiums (Next 7 days): ${stats.upcomingPremiums}\n` +
      `\n` +
      `System Uptime: ${stats.uptime} hours\n` +
      `Average Processing Time: ${stats.avgProcessingTime}ms\n` +
      `\n` +
      `Next Scheduled Cleanup: ${stats.nextCleanup}\n` +
      `\n` +
      `System Status: ${stats.systemStatus}\n` +
      `\n` +
      `Regards,\n` +
      `WhatsApp Reminder System`;
  }

  async getSystemStatus() {
    const stats = await this.excelReader.getRecordStats();
    const scheduledTasksInfo = this.scheduledTasks.map(t => ({
      name: t.name,
      description: t.description,
      status: 'scheduled'
    }));

    return {
      systemStatus: 'running',
      lastCheck: new Date().toISOString(),
      pendingReminders: stats.pendingReminders,
      scheduledTasks: scheduledTasksInfo,
      whatsappConnected: this.whatsappService.isConnected,
      processedFiles: this.excelReader.processedFiles.size,
      rateLimitStatus: await this.whatsappService.rateLimiter.getGlobalStats()
    };
  }

  async pauseScheduling() {
    this.logger.info('Pausing all scheduled tasks...');

    for (const task of this.scheduledTasks) {
      task.task.stop();
    }

    this.logger.info('All scheduled tasks paused');
  }

  async resumeScheduling() {
    this.logger.info('Resuming all scheduled tasks...');

    for (const task of this.scheduledTasks) {
      task.task.start();
    }

    this.logger.info('All scheduled tasks resumed');
  }

  async stop() {
    this.logger.info('Stopping reminder scheduler...');

    for (const task of this.scheduledTasks) {
      task.task.stop();
      this.logger.info(`Stopped task: ${task.name}`);
    }

    this.scheduledTasks = [];
    this.logger.info('Reminder scheduler stopped successfully');
  }

  async addCustomTask(cronExpression, taskName, taskFunction, description) {
    try {
      const task = cron.schedule(cronExpression, async () => {
        this.logger.info(`Running custom task: ${taskName}`);
        await taskFunction();
      });

      this.scheduledTasks.push({
        name: taskName,
        task: task,
        description: description
      });

      this.logger.info(`Added custom task: ${taskName}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add custom task ${taskName}:`, error);
      return false;
    }
  }

  async removeTask(taskName) {
    const taskIndex = this.scheduledTasks.findIndex(task => task.name === taskName);

    if (taskIndex !== -1) {
      this.scheduledTasks[taskIndex].task.stop();
      this.scheduledTasks.splice(taskIndex, 1);
      this.logger.info(`Removed task: ${taskName}`);
      return true;
    }

    this.logger.warn(`Task not found: ${taskName}`);
    return false;
  }

  async getTaskInfo(taskName) {
    const task = this.scheduledTasks.find(task => task.name === taskName);

    if (task) {
      return {
        name: task.name,
        description: task.description,
        status: 'scheduled'
      };
    }

    return null;
  }

  async updateTaskCron(taskName, newCronExpression) {
    const task = this.scheduledTasks.find(task => task.name === taskName);

    if (task) {
      task.task.stop();
      task.task = cron.schedule(newCronExpression, async () => {
        this.logger.info(`Running task: ${taskName}`);
        await task.task();
      });

      this.logger.info(`Updated cron for task ${taskName} to: ${newCronExpression}`);
      return true;
    }

    this.logger.warn(`Task not found: ${taskName}`);
    return false;
  }
}

module.exports = { ReminderScheduler };