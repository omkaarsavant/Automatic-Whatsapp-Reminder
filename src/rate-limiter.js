const { RateLimiterMemory } = require('rate-limiter-flexible');
const { Logger } = require('./logger');

class RateLimiter {
  constructor(logger) {
    this.logger = logger;
    this.limiter = new RateLimiterMemory({
      keyGenerator: (params) => params.phone,
      points: 10, // 10 messages per window
      duration: 3600 // per hour
    });

    this.messageLog = new Map();
    this.messageWindow = 3600000; // 1 hour in milliseconds
  }

  async checkRateLimit(phoneNumber) {
    try {
      const currentTimestamp = Date.now();

      // Clean up old message logs
      this.cleanupOldLogs(currentTimestamp);

      // Check if we've already sent messages to this number recently
      const recentMessages = this.messageLog.get(phoneNumber) || [];
      const recentCount = recentMessages.filter(msg =>
        currentTimestamp - msg.timestamp < this.messageWindow
      ).length;

      if (recentCount >= 5) {
        throw new Error(`Rate limit exceeded for ${phoneNumber}: ${recentCount} messages in last hour`);
      }

      // Check with the rate limiter
      await this.limiter.consume(phoneNumber);

      return true;
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${phoneNumber}:`, error);
      throw error;
    }
  }

  async registerMessage(phoneNumber) {
    try {
      const currentTimestamp = Date.now();

      if (!this.messageLog.has(phoneNumber)) {
        this.messageLog.set(phoneNumber, []);
      }

      this.messageLog.get(phoneNumber).push({
        timestamp: currentTimestamp,
        phoneNumber: phoneNumber
      });

      // Clean up old logs
      this.cleanupOldLogs(currentTimestamp);

      return true;
    } catch (error) {
      this.logger.error(`Failed to register message for ${phoneNumber}:`, error);
      throw error;
    }
  }

  cleanupOldLogs(currentTimestamp) {
    const cutoffTime = currentTimestamp - this.messageWindow;

    for (const [phoneNumber, messages] of this.messageLog.entries()) {
      const filteredMessages = messages.filter(msg => msg.timestamp >= cutoffTime);

      if (filteredMessages.length === 0) {
        this.messageLog.delete(phoneNumber);
      } else {
        this.messageLog.set(phoneNumber, filteredMessages);
      }
    }
  }

  async getRateLimitStatus(phoneNumber) {
    try {
      const currentTimestamp = Date.now();
      this.cleanupOldLogs(currentTimestamp);

      const recentMessages = this.messageLog.get(phoneNumber) || [];
      const recentCount = recentMessages.filter(msg =>
        currentTimestamp - msg.timestamp < this.messageWindow
      ).length;

      const limiterInfo = await this.limiter.get(phoneNumber);
      const remaining = limiterInfo ? limiterInfo.remainingPoints : 10;

      return {
        recentMessages: recentCount,
        remainingQuota: remaining,
        totalMessages: recentCount + (10 - remaining),
        windowRemaining: Math.ceil((this.messageWindow - (currentTimestamp - recentMessages[0]?.timestamp || 0)) / 60000)
      };
    } catch (error) {
      this.logger.error(`Failed to get rate limit status for ${phoneNumber}:`, error);
      throw error;
    }
  }

  async resetRateLimit(phoneNumber) {
    try {
      await this.limiter.delete(phoneNumber);
      this.messageLog.delete(phoneNumber);
      this.logger.info(`Rate limit reset for ${phoneNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to reset rate limit for ${phoneNumber}:`, error);
      throw error;
    }
  }

  async getGlobalStats() {
    try {
      const currentTimestamp = Date.now();
      this.cleanupOldLogs(currentTimestamp);

      const stats = {
        totalPhoneNumbers: this.messageLog.size,
        totalMessages: 0,
        messagesPerPhone: {}
      };

      for (const [phoneNumber, messages] of this.messageLog.entries()) {
        const recentCount = messages.filter(msg =>
          currentTimestamp - msg.timestamp < this.messageWindow
        ).length;

        stats.totalMessages += recentCount;
        stats.messagesPerPhone[phoneNumber] = recentCount;
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get global rate limit stats:', error);
      throw error;
    }
  }
}

module.exports = { RateLimiter };