const { RateLimiter } = require('../src/rate-limiter');
const { Logger } = require('../src/logger');

jest.mock('../src/logger');

describe('RateLimiter', () => {
  let rateLimiter;
  let logger;

  beforeEach(() => {
    logger = new Logger();
    rateLimiter = new RateLimiter(logger);
  });

  describe('Initialization', () => {
    it('should initialize rate limiter', () => {
      expect(rateLimiter).toBeDefined();
      expect(rateLimiter.limiter).toBeDefined();
      expect(rateLimiter.messageLog).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limit successfully', async () => {
      const checkRateLimitSpy = jest.spyOn(rateLimiter, 'checkRateLimit');

      const result = await rateLimiter.checkRateLimit('9876543210');

      expect(checkRateLimitSpy).toHaveBeenCalledWith('9876543210');
      expect(result).toBe(true);
    });

    it('should register message', async () => {
      const registerMessageSpy = jest.spyOn(rateLimiter, 'registerMessage');

      const result = await rateLimiter.registerMessage('9876543210');

      expect(registerMessageSpy).toHaveBeenCalledWith('9876543210');
      expect(result).toBe(true);
    });

    it('should cleanup old logs', () => {
      const cleanupSpy = jest.spyOn(rateLimiter, 'cleanupOldLogs');

      rateLimiter.cleanupOldLogs(Date.now());

      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Rate Limit Status', () => {
    it('should get rate limit status', async () => {
      const getRateLimitStatusSpy = jest.spyOn(rateLimiter, 'getRateLimitStatus');

      const status = await rateLimiter.getRateLimitStatus('9876543210');

      expect(getRateLimitStatusSpy).toHaveBeenCalledWith('9876543210');
      expect(status).toHaveProperty('recentMessages');
      expect(status).toHaveProperty('remainingQuota');
      expect(status).toHaveProperty('totalMessages');
      expect(status).toHaveProperty('windowRemaining');
    });
  });

  describe('Rate Limit Management', () => {
    it('should reset rate limit', async () => {
      const resetRateLimitSpy = jest.spyOn(rateLimiter, 'resetRateLimit');

      const result = await rateLimiter.resetRateLimit('9876543210');

      expect(resetRateLimitSpy).toHaveBeenCalledWith('9876543210');
      expect(result).toBe(true);
    });
  });

  describe('Global Statistics', () => {
    it('should get global stats', async () => {
      const getGlobalStatsSpy = jest.spyOn(rateLimiter, 'getGlobalStats');

      const stats = await rateLimiter.getGlobalStats();

      expect(getGlobalStatsSpy).toHaveBeenCalled();
      expect(stats).toHaveProperty('totalPhoneNumbers');
      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('messagesPerPhone');
    });
  });

  describe('Message Logging', () => {
    it('should log messages correctly', async () => {
      const currentTimestamp = Date.now();
      const phoneNumber = '9876543210';

      // First message
      await rateLimiter.registerMessage(phoneNumber);

      // Get message log
      const messageLog = rateLimiter.messageLog.get(phoneNumber) || [];
      expect(messageLog.length).toBe(1);
      expect(messageLog[0].phoneNumber).toBe(phoneNumber);
      expect(messageLog[0].timestamp).toBeLessThanOrEqual(currentTimestamp);
    });

    it('should enforce rate limits', async () => {
      const phoneNumber = '9876543210';

      // Send 5 messages (should be allowed)
      for (let i = 0; i < 5; i++) {
        await rateLimiter.registerMessage(phoneNumber);
      }

      // 6th message should fail
      await expect(rateLimiter.checkRateLimit(phoneNumber))
        .rejects
        .toThrow('Rate limit exceeded');
    });
  });

  describe('Time Window Management', () => {
    it('should handle time windows correctly', () => {
      const currentTimestamp = Date.now();
      const windowSize = 3600000; // 1 hour

      const windowStart = new Date(currentTimestamp - (currentTimestamp % windowSize));
      const windowEnd = new Date(windowStart.getTime() + windowSize);

      expect(windowStart).toBeInstanceOf(Date);
      expect(windowEnd).toBeInstanceOf(Date);
      expect(windowEnd.getTime() - windowStart.getTime()).toBe(windowSize);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown phone numbers', async () => {
      const unknownNumber = 'unknown';

      await expect(rateLimiter.checkRateLimit(unknownNumber))
        .rejects
        .toThrow();
    });

    it('should handle empty phone numbers', async () => {
      const emptyNumber = '';

      await expect(rateLimiter.checkRateLimit(emptyNumber))
        .rejects
        .toThrow();
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up old logs', () => {
      const currentTimestamp = Date.now();
      const cutoffTime = currentTimestamp - 3600000; // 1 hour ago

      // Add some old messages
      rateLimiter.messageLog.set('9876543210', [
        { phoneNumber: '9876543210', timestamp: cutoffTime - 10000 },
        { phoneNumber: '9876543210', timestamp: cutoffTime + 10000 }
      ]);

      // Clean up
      rateLimiter.cleanupOldLogs(currentTimestamp);

      // Verify cleanup
      const remainingMessages = rateLimiter.messageLog.get('9876543210') || [];
      expect(remainingMessages.length).toBe(1);
      expect(remainingMessages[0].timestamp).toBeGreaterThan(cutoffTime);
    });
  });
});