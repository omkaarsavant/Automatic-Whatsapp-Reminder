# WhatsApp Reminder System - Production Architecture Plan

## Context
This system is designed to automatically read LIC premium data from Excel files and send WhatsApp reminders when premiums are due. The goal is to create a robust, 24/7 running production system that can handle 200+ reminders per day safely on a Linux server.

## Technical Stack Selection

### Core Libraries
- **WhatsApp Automation**: Baileys (multi-device protocol) - lighter than whatsapp-web.js, no Puppeteer overhead
- **Excel Parsing**: exceljs (streaming mode for large files) - handles potentially large Excel files efficiently
- **Scheduling**: node-cron (simple recurring tasks) - sufficient for hourly Excel checks
- **Database**: SQLite (file-based, zero-config) - simple and reliable for this use case
- **Logging**: Winston with daily rotation - structured logging for debugging
- **Rate Limiting**: rate-limiter-flexible - general purpose rate limiting
- **Process Management**: PM2 - Node.js process management with auto-restart

### Architecture Overview
```
WhatsApp Reminder System
├── Main Process (PM2)
│   ├── Excel Reader Service
│   ├── Reminder Scheduler (node-cron)
│   ├── WhatsApp Service (Baileys)
│   └── Rate Limiter
├── Data Layer
│   ├── SQLite Database (reminders, logs, sent messages)
│   └── JSON Files (sessions, configuration)
└── File System
    ├── Excel Input Directory
    └── Logs Directory
```

## System Components

### 1. WhatsApp Service (Baileys)
- Handles WhatsApp connection and message sending
- Manages session persistence with encrypted storage
- Implements auto-reconnect on disconnection
- Provides error handling for bans and rate limits

### 2. Excel Reader Service
- Monitors Excel directory for new files
- Uses exceljs streaming to handle large files efficiently
- Validates data format and phone numbers
- Filters records based on due dates and payment status

### 3. Reminder Scheduler
- Runs every hour to check for due premiums
- Calculates reminders for today, 1 day before, and 7 days before
- Prevents duplicate reminders using sent logs
- Implements rate limiting to avoid WhatsApp bans

### 4. Data Persistence
- SQLite database for:
  - Sent reminders (prevents duplicates)
  - Customer information
  - System logs
  - Configuration settings
- JSON files for:
  - WhatsApp session data
  - Rate limiting state

### 5. Error Handling & Recovery
- WhatsApp disconnections: auto-reconnect with exponential backoff
- File read errors: retry with fallback to next check
- Rate limit hits: queue messages for later
- Process crashes: PM2 auto-restart
- Session corruption: regenerate session with QR code

## Critical Files to Create

### Core Application Files
- `package.json` - Dependencies and scripts
- `src/index.js` - Main application entry point
- `src/whatsapp-service.js` - WhatsApp connection and messaging
- `src/excel-reader.js` - Excel file parsing and validation
- `src/reminder-scheduler.js` - Scheduling logic
- `src/rate-limiter.js` - Rate limiting implementation
- `src/database.js` - SQLite database operations
- `src/logger.js` - Winston logging configuration

### Configuration Files
- `config.json` - System configuration
- `ecosystem.config.js` - PM2 configuration
- `.env` - Environment variables (if needed)

### Data Files
- `database.sqlite` - SQLite database
- `sessions/` - WhatsApp session storage
- `logs/` - Application logs
- `data/` - Excel files directory

### Example Files
- `example-input.xlsx` - Sample Excel file format
- `README.md` - Setup and deployment instructions

## Implementation Strategy

### Phase 1: Core Infrastructure
1. Initialize Node.js project with package.json
2. Set up SQLite database schema
3. Configure Winston logging
4. Create PM2 ecosystem configuration

### Phase 2: WhatsApp Service
1. Implement Baileys client with session persistence
2. Add auto-reconnect and error handling
3. Create message sending with validation
4. Implement QR code handling for initial setup

### Phase 3: Excel Processing
1. Create exceljs streaming reader
2. Implement data validation and filtering
3. Add file monitoring for new Excel files
4. Create data transformation to internal format

### Phase 4: Scheduling & Logic
1. Implement node-cron scheduler
2. Create reminder calculation logic (today, 1 day, 7 days)
3. Add duplicate prevention using sent logs
4. Implement rate limiting for WhatsApp messages

### Phase 5: Production Features
1. Add comprehensive error handling
2. Implement logging and monitoring
3. Create health check endpoints
4. Add graceful shutdown handling

## Testing & Verification

### Unit Tests
- WhatsApp service connection and messaging
- Excel file parsing and validation
- Rate limiter functionality
- Database operations

### Integration Tests
- End-to-end reminder flow
- Error handling scenarios
- Rate limiting behavior
- Session persistence

### Production Testing
- Deploy to test Linux server
- Verify 24/7 operation
- Test auto-restart on crashes
- Monitor resource usage

## Security Considerations

- Store WhatsApp session data securely
- Validate all input data from Excel files
- Use environment variables for sensitive configuration
- Implement proper error handling to avoid information leakage
- Rate limiting to prevent abuse

## Scalability Planning

- Current design handles 200+ reminders per day easily
- Can scale to multiple WhatsApp numbers if needed
- Database can be migrated to PostgreSQL for larger scale
- Message queue can be added for higher throughput

## Deployment Instructions

1. Install Node.js and PM2 on Linux server
2. Clone repository and install dependencies
3. Configure environment variables
4. Set up systemd service for PM2
5. Test with sample data
6. Monitor logs and set up alerts

This architecture provides a robust, production-ready solution that can run 24/7 with minimal manual intervention while safely handling WhatsApp automation requirements.

## Current Directory Status

The working directory is empty - no files exist yet. This is a fresh implementation from scratch. All components need to be created as outlined in the plan.

If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\OMKAR\.claude\projects\D--Reminder\f107dec3-25d7-4621-9f2e-cb64f91a296a.jsonl