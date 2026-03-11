module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/test/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/logger.js',
    '!src/database.js',
    '!src/whatsapp-service.js',
    '!src/excel-reader.js',
    '!src/reminder-scheduler.js',
    '!src/rate-limiter.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  moduleNameMapping: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1',
    '^config$': '<rootDir>/config.json'
  },
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  testTimeout: 10000,
  verbose: true
};