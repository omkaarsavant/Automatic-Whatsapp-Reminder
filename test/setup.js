// Test setup file for WhatsApp Reminder System

// Mock Node.js modules
jest.mock('fs');
jest.mock('path');
jest.mock('winston');
jest.mock('sqlite3');
jest.mock('baileys');
jest.mock('exceljs');
jest.mock('node-cron');
jest.mock('rate-limiter-flexible');
jest.mock('dotenv');
jest.mock('moment');
jest.mock('uuid');
jest.mock('pm2');
jest.mock('express');

// Mock configuration
const mockConfig = {
  system: {
    name: 'WhatsApp Reminder System',
    version: '1.0.0',
    environment: 'test',
    logLevel: 'debug'
  },
  whatsapp: {
    sessionPath: 'sessions/whatsapp-session.json',
    autoReconnect: true,
    maxReconnectAttempts: 3,
    reconnectDelay: 1000
  },
  excel: {
    inputDir: 'data/excel',
    processedDir: 'data/excel/processed',
    backupDir: 'data/excel/backup'
  },
  database: {
    path: 'database.sqlite',
    backupPath: 'data/backups/database.sqlite.backup'
  },
  scheduler: {
    hourlyCheck: '0 * * * *',
    dailyCleanup: '0 2 * * *',
    weeklyReport: '0 9 * * 1'
  },
  reminders: {
    types: ['today', 'one_day_before', 'seven_days_before']
  },
  logging: {
    level: 'debug',
    file: {
      maxSize: '10m',
      maxFiles: 5,
      path: 'logs'
    },
    console: {
      enabled: true
    }
  }
};

// Global mocks
global.config = mockConfig;

// Mock file system
const fs = require('fs');
const path = require('path');

beforeEach(() => {
  // Clear mocks
  jest.clearAllMocks();

  // Mock file system structure
  fs.existsSync.mockImplementation((filePath) => {
    const testPaths = [
      'data/excel',
      'data/backups',
      'logs',
      'logs/sessions',
      'sessions',
      'database.sqlite'
    ];
    return testPaths.includes(filePath);
  });

  fs.mkdirSync.mockImplementation((dirPath, options) => {
    if (!fs.existsSync(dirPath)) {
      fs.existsSync.mockImplementationOnce((filePath) => {
        return testPaths.includes(filePath);
      });
    }
  });

  fs.readdirSync.mockReturnValue(['example-input.xlsx']);
  fs.readFileSync.mockReturnValue(JSON.stringify({ session: 'data' }));
  fs.writeFileSync.mockImplementation();
  fs.renameSync.mockImplementation();
  fs.unlinkSync.mockImplementation();

  // Mock path functions
  path.join.mockImplementation((...args) => args.join('/'));
  path.dirname.mockImplementation((filePath) => {
    return filePath.split('/').slice(0, -1).join('/');
  });

  // Mock winston logger
  const winston = require('winston');
  winston.createLogger.mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
    transports: []
  });

  // Mock sqlite3
  const sqlite3 = require('sqlite3');
  sqlite3.Database.mockImplementation(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn()
  }));

  // Mock Baileys
  const { Client } = require('baileys');
  Client.mockImplementation(() => ({
    init: jest.fn(),
    close: jest.fn(),
    sendMessage: jest.fn(),
    getContact: jest.fn(),
    getGroupMetadata: jest.fn(),
    createGroup: jest.fn(),
    groupAdd: jest.fn(),
    groupRemove: jest.fn(),
    groupMakeAdmin: jest.fn(),
    groupDemoteAdmin: jest.fn(),
    loadMessages: jest.fn(),
    updatePresence: jest.fn(),
    sendImage: jest.fn(),
    sendDocument: jest.fn(),
    sendLocation: jest.fn(),
    sendContact: jest.fn(),
    on: jest.fn(),
    off: jest.fn()
  }));

  // Mock ExcelJS
  const ExcelJS = require('exceljs');
  ExcelJS.Workbook.mockImplementation(() => ({
    addWorksheet: jest.fn(),
    getWorksheet: jest.fn(),
    eachSheet: jest.fn(),
    xlsx: {
      readFile: jest.fn(),
      writeFile: jest.fn()
    }
  }));

  // Mock cron
  const cron = require('node-cron');
  cron.schedule.mockReturnValue({
    start: jest.fn(),
    stop: jest.fn(),
    running: false,
    nextDate: jest.fn()
  });

  // Mock rate limiter
  const { RateLimiterMemory } = require('rate-limiter-flexible');
  RateLimiterMemory.mockImplementation(() => ({
    consume: jest.fn(),
    get: jest.fn(),
    delete: jest.fn()
  }));

  // Mock dotenv
  const dotenv = require('dotenv');
  dotenv.config.mockReturnValue({ parsed: {} });

  // Mock moment
  const moment = require('moment');
  moment.mockImplementation((date) => ({
    isValid: () => true,
    toDate: () => new Date(date),
    format: () => date
  }));

  // Mock PM2
  const pm2 = require('pm2');
  pm2.connect.mockImplementation((callback) => callback(null));
  pm2.launchBus.mockImplementation((callback) => callback(null, {
    on: jest.fn()
  }));

  // Mock Express
  const express = require('express');
  express.mockReturnValue({
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn()
  });

  // Mock UUID
  const uuid = require('uuid');
  uuid.v4.mockReturnValue('test-uuid');
});

afterEach(() => {
  // Restore all mocks
  jest.restoreAllMocks();
});

// Helper functions for tests
global.createTestExcelFile = (filename, data) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Premiums');

  worksheet.columns = [
    { header: 'Policy Number', key: 'policy_number' },
    { header: 'Customer Name', key: 'customer_name' },
    { header: 'Phone Number', key: 'phone_number' },
    { header: 'Premium Amount', key: 'premium_amount' },
    { header: 'Due Date', key: 'due_date' }
  ];

  data.forEach((row, index) => {
    const worksheetRow = worksheet.getRow(index + 2);
    worksheetRow.values = [
      row.policy_number,
      row.customer_name,
      row.phone_number,
      row.premium_amount,
      row.due_date
    ];
  });

  return workbook.xlsx.writeFile(filename);
};

global.createTestDatabase = () => {
  const sqlite3 = require('sqlite3');
  const db = new sqlite3.Database(':memory:');

  // Create tables
  db.run(`CREATE TABLE records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    premium_amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    policy_status TEXT NOT NULL,
    email TEXT,
    policy_type TEXT,
    premium_frequency TEXT,
    last_payment_date TEXT,
    next_due_date TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
  )`);

  db.run(`CREATE TABLE sent_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_number TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    reminder_type TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent',
    error_message TEXT
  )`);

  db.run(`CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  return db;
};