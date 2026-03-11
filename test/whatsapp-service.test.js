const { WhatsAppService } = require('../src/whatsapp-service');
const { Logger } = require('../src/logger');
const { Database } = require('../src/database');
const { RateLimiter } = require('../src/rate-limiter');

jest.mock('../src/logger');
jest.mock('../src/database');
jest.mock('../src/rate-limiter');

describe('WhatsAppService', () => {
  let whatsappService;
  let logger;
  let database;
  let rateLimiter;

  beforeEach(() => {
    logger = new Logger();
    database = new Database(logger);
    rateLimiter = new RateLimiter(logger);
    whatsappService = new WhatsAppService(logger, database);
  });

  describe('Initialization', () => {
    it('should initialize WhatsApp service', async () => {
      const setupSessionSpy = jest.spyOn(whatsappService, 'setupSession').mockResolvedValue();
      const setupClientSpy = jest.spyOn(whatsappService, 'setupClient').mockResolvedValue();

      await whatsappService.init();

      expect(setupSessionSpy).toHaveBeenCalled();
      expect(setupClientSpy).toHaveBeenCalled();
    });

    it('should handle session setup', async () => {
      const fs = require('fs');
      const path = require('path');

      // Mock existing session
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(true);
      jest.spyOn(fs, 'readFileSync').mockReturnValueOnce(JSON.stringify({ session: 'data' }));

      await whatsappService.setupSession();

      expect(whatsappService.session).toEqual({ session: 'data' });
    });

    it('should handle new session creation', async () => {
      const fs = require('fs');
      const path = require('path');

      // Mock no existing session
      jest.spyOn(fs, 'existsSync').mockReturnValueOnce(false);

      await whatsappService.setupSession();

      expect(whatsappService.session).toBeNull();
    });
  });

  describe('Message Sending', () => {
    it('should send message successfully', async () => {
      const mockClient = {
        sendMessage: jest.fn().mockResolvedValue()
      };
      whatsappService.client = mockClient;
      whatsappService.isConnected = true;

      const rateLimiterMock = {
        checkRateLimit: jest.fn().mockResolvedValue(),
        registerMessage: jest.fn().mockResolvedValue()
      };
      whatsappService.rateLimiter = rateLimiterMock;

      const result = await whatsappService.sendMessage('9876543210', 'Test message');

      expect(result.success).toBe(true);
      expect(mockClient.sendMessage).toHaveBeenCalledWith('9876543210@s.whatsapp.net', 'Test message');
      expect(rateLimiterMock.checkRateLimit).toHaveBeenCalledWith('9876543210');
      expect(rateLimiterMock.registerMessage).toHaveBeenCalledWith('9876543210');
    });

    it('should format phone number correctly', () => {
      expect(whatsappService.formatPhoneNumber('+919876543210')).toBe('9876543210');
      expect(whatsappService.formatPhoneNumber('919876543210')).toBe('9876543210');
      expect(whatsappService.formatPhoneNumber('09876543210')).toBe('9876543210');
      expect(whatsappService.formatPhoneNumber('9876543210')).toBe('9876543210');
    });

    it('should throw error if not connected', async () => {
      whatsappService.isConnected = false;

      await expect(whatsappService.sendMessage('9876543210', 'Test message'))
        .rejects
        .toThrow('WhatsApp client not connected');
    });
  });

  describe('Connection Handling', () => {
    it('should check connection and reconnect if needed', async () => {
      const mockClient = {
        init: jest.fn().mockResolvedValue()
      };
      whatsappService.client = mockClient;
      whatsappService.isConnected = false;

      await whatsappService.checkConnection();

      expect(mockClient.init).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      const mockClient = {
        init: jest.fn().mockResolvedValue()
      };
      whatsappService.client = mockClient;
      whatsappService.isConnected = true;

      await whatsappService.checkConnection();

      expect(mockClient.init).not.toHaveBeenCalled();
    });
  });

  describe('Advanced Features', () => {
    it('should handle QR code generation', () => {
      const mockClient = {
        on: jest.fn()
      };
      whatsappService.client = mockClient;

      // This is more of an integration test, but we can verify the event handler is set up
      expect(mockClient.on).toHaveBeenCalledWith('qr', expect.any(Function));
    });

    it('should handle authentication success', () => {
      const mockClient = {
        on: jest.fn()
      };
      whatsappService.client = mockClient;

      // Verify auth handler is set up
      const authHandlers = mockClient.on.mock.calls.filter(([event]) => event === 'authenticated');
      expect(authHandlers.length).toBe(1);
    });
  });
});