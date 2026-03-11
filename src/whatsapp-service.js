const fs = require('fs');
const path = require('path');
const Baileys = require('@whiskeysockets/baileys');
const makeWASocket = Baileys.default || Baileys.makeWASocket || Baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = Baileys;
const pino = require('pino');
const loggerPino = pino({ level: 'silent' });
const qrcode = require('qrcode-terminal');
const { RateLimiter } = require('./rate-limiter');

class WhatsAppService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
    this.rateLimiter = null;
    this.client = null;
    this.isConnected = false;
    this.sessionDir = path.join(__dirname, '../sessions/whatsapp-auth');
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.onConnectionRestored = null;
  }

  async init() {
    try {
      this.logger.info('Initializing WhatsApp service...');
      this.rateLimiter = new RateLimiter(this.logger);
      await this.setupClient();
      this.logger.info('WhatsApp service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize WhatsApp service:', error);
      throw error;
    }
  }

  async setupClient() {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

    // Fetch latest WA web version to avoid 405 errors
    let version;
    try {
      const versionInfo = await fetchLatestBaileysVersion();
      version = versionInfo.version;
      this.logger.info(`Using WA web version: ${version}`);
    } catch (e) {
      this.logger.warn('Could not fetch latest WA version, using default');
    }

    const socketConfig = {
      auth: state,
      logger: loggerPino,
    };

    // Use Browsers helper if available, otherwise use a safe default
    if (Baileys.Browsers) {
      socketConfig.browser = Baileys.Browsers.ubuntu('Chrome');
    } else {
      socketConfig.browser = ['Ubuntu', 'Chrome', '20.0.04'];
    }

    if (version) {
      socketConfig.version = version;
    }

    this.client = makeWASocket(socketConfig);

    this.client.ev.on('creds.update', saveCreds);

    this.client.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.logger.info('Scan this QR code with WhatsApp > Linked Devices > Link a Device:');
        console.log(''); // blank line for readability
        qrcode.generate(qr, { small: true });
        console.log(''); // blank line for readability
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.logger.warn(`WhatsApp connection closed (status: ${statusCode})`);
        this.isConnected = false;

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delayMs = Math.min(5000 * this.reconnectAttempts, 30000);
          this.logger.info(`Reconnecting in ${delayMs / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.setupClient(), delayMs);
        } else if (!shouldReconnect) {
          this.logger.error('Logged out from WhatsApp. Delete sessions/whatsapp-auth folder and restart.');
        } else {
          this.logger.error('Max reconnect attempts reached. Please restart the application.');
        }
      } else if (connection === 'open') {
        this.logger.info('WhatsApp connected successfully!');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        if (this.onConnectionRestored) {
          this.onConnectionRestored();
        }
      }
    });
  }

  async disconnect() {
    if (this.client) {
      this.logger.info('Disconnecting WhatsApp client...');
      this.client.end();
      this.isConnected = false;
    }
  }

  async sendMessage(phoneNumber, message) {
    if (!this.isConnected || !this.client) {
      throw new Error('WhatsApp client not connected');
    }

    try {
      await this.rateLimiter.checkRateLimit(phoneNumber);

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const jid = formattedNumber + '@s.whatsapp.net';

      this.logger.info(`Sending message to ${formattedNumber}: ${message}`);

      await this.client.sendMessage(jid, { text: message });

      await this.rateLimiter.registerMessage(phoneNumber);

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to send message to ${phoneNumber}:`, error);
      throw error;
    }
  }

  formatPhoneNumber(phoneNumber) {
    let formatted = phoneNumber.replace(/\D/g, ''); // Remove non-numeric
    if (formatted.length === 10) {
      formatted = '91' + formatted; // Assume Indian number if 10 digits
    }
    return formatted;
  }

  async checkConnection() {
    return this.isConnected;
  }

  async sendImage(phoneNumber, imagePath, caption = '') {
    if (!this.isConnected || !this.client) throw new Error('WhatsApp client not connected');
    const jid = this.formatPhoneNumber(phoneNumber) + '@s.whatsapp.net';
    await this.client.sendMessage(jid, {
      image: { url: imagePath },
      caption: caption
    });
    return { success: true };
  }

  async sendDocument(phoneNumber, documentPath, filename = null) {
    if (!this.isConnected || !this.client) throw new Error('WhatsApp client not connected');
    const jid = this.formatPhoneNumber(phoneNumber) + '@s.whatsapp.net';
    await this.client.sendMessage(jid, {
      document: { url: documentPath },
      fileName: filename || path.basename(documentPath),
      mimetype: 'application/octet-stream'
    });
    return { success: true };
  }

  async sendLocation(phoneNumber, latitude, longitude, address = '') {
    if (!this.isConnected || !this.client) throw new Error('WhatsApp client not connected');
    const jid = this.formatPhoneNumber(phoneNumber) + '@s.whatsapp.net';
    await this.client.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: address
      }
    });
    return { success: true };
  }

  async sendContact(phoneNumber, contactNumber, contactName) {
    if (!this.isConnected || !this.client) throw new Error('WhatsApp client not connected');
    const jid = this.formatPhoneNumber(phoneNumber) + '@s.whatsapp.net';
    const vcard = 'BEGIN:VCARD\n' +
                'VERSION:3.0\n' +
                'FN:' + contactName + '\n' +
                'TEL;type=CELL;type=VOICE;waid=' + this.formatPhoneNumber(contactNumber) + ':+' + this.formatPhoneNumber(contactNumber) + '\n' +
                'END:VCARD';
    await this.client.sendMessage(jid, {
      contacts: {
        displayName: contactName,
        contacts: [{ vcard }]
      }
    });
    return { success: true };
  }
}

module.exports = { WhatsAppService };