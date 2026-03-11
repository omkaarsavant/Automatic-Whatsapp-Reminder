# WhatsApp Reminder System for LIC Premiums

A robust, production-ready system that automatically reads LIC premium data from Excel files and sends WhatsApp reminders when premiums are due.

## 🚀 Features

- **Automated Excel Processing**: Monitors Excel directory for new files and processes them efficiently
- **WhatsApp Integration**: Uses Baileys (multi-device protocol) for reliable WhatsApp messaging
- **Smart Scheduling**: Sends reminders at optimal times (today, 1 day before, 7 days before)
- **Rate Limiting**: Prevents WhatsApp bans with intelligent rate limiting
- **24/7 Operation**: Designed for continuous production use with auto-restart
- **Comprehensive Logging**: Structured logging with daily rotation for easy debugging
- **SQLite Database**: Simple, reliable data persistence with backup support
- **Health Monitoring**: Built-in health checks and metrics endpoints
- **Error Recovery**: Automatic reconnection and error handling

## 📋 System Architecture

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

## 🛠️ Technical Stack

- **WhatsApp Automation**: Baileys (multi-device protocol)
- **Excel Processing**: exceljs (streaming mode for large files)
- **Scheduling**: node-cron
- **Database**: SQLite
- **Logging**: Winston with daily rotation
- **Rate Limiting**: rate-limiter-flexible
- **Process Management**: PM2
- **Runtime**: Node.js 16+

## 📦 Installation

### Prerequisites
- Node.js 16 or higher
- PM2 (for production deployment)
- WhatsApp account with QR code access

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-reminder-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create required directories**
   ```bash
   mkdir -p data/excel data/backups logs/sessions
   ```

5. **Initialize the database**
   ```bash
   node src/index.js --init
   ```

## 🚀 Quick Start

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Start with PM2
npm run pm2

# Or manually
npm start
```

## 📁 Configuration

### Environment Variables (.env)
```env
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Database Configuration
db_path=./database.sqlite

# WhatsApp Configuration
WHATSAPP_SESSION_PATH=./sessions/whatsapp-session.json
WHATSAPP_AUTO_RECONNECT=true
WHATSAPP_MAX_RECONNECT_ATTEMPTS=5

# Excel Configuration
EXCEL_INPUT_DIR=./data/excel
EXCEL_PROCESSED_DIR=./data/excel/processed

# Rate Limiting
RATE_LIMIT_DAILY=200
RATE_LIMIT_WINDOW=3600

# Reminder Configuration
REMINDER_TYPES=today,one_day_before,seven_days_before

# Logging Configuration
LOG_DIR=./logs
LOG_MAX_SIZE=10m
LOG_MAX_FILES=7

# Health Check Configuration
HEALTH_CHECK_INTERVAL=60000
HEALTH_CHECK_TIMEOUT=30000
```

### Excel File Format

The system expects Excel files with the following columns:

| Column Name | Description | Required |
|-------------|-------------|----------|
| Policy Number | Unique policy identifier | ✅ Yes |
| Customer Name | Customer's full name | ✅ Yes |
| Phone Number | 10-digit mobile number | ✅ Yes |
| Premium Amount | Premium amount in INR | ✅ Yes |
| Due Date | Premium due date (DD/MM/YYYY) | ✅ Yes |
| Policy Status | Active/Inactive/Lapsed | 🗻 Optional |
| Email | Customer email address | 📋 Optional |
| Policy Type | Type of policy (e.g., Endowment) | 📋 Optional |
| Premium Frequency | Monthly/Quarterly/Half-yearly/Yearly | 📋 Optional |
| Last Payment Date | Date of last payment | 📋 Optional |
| Next Due Date | Next premium due date | 📋 Optional |

### Sample Excel File

Create `data/excel/example-input.xlsx` with:

| Policy Number | Customer Name | Phone Number | Premium Amount | Due Date | Policy Status |
|---------------|---------------|--------------|----------------|----------|---------------|
| LIC12345678 | John Doe | 9876543210 | 5000 | 15/03/2026 | Active |
| LIC87654321 | Jane Smith | 9876543211 | 7500 | 20/03/2026 | Active |

## 🔧 Usage

### 1. Initial Setup

1. Place your Excel files in the `data/excel` directory
2. Start the system: `npm start`
3. Scan the QR code that appears in the console
4. The system will automatically process files and send reminders

### 2. File Processing

The system automatically:
- Monitors the Excel directory every hour
- Processes new files and validates data
- Sends reminders for premiums due today, tomorrow, and 7 days from now
- Moves processed files to `data/excel/processed`

### 3. WhatsApp Connection

- First run: Scan QR code to authenticate
- Subsequent runs: Uses saved session automatically
- Auto-reconnects if connection is lost
- Handles rate limits and bans gracefully

## 📊 Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3000/health
```

### System Metrics
```bash
curl http://localhost:3000/metrics
```

### System Status
```bash
curl http://localhost:3000/status
```

### View Logs
```bash
curl http://localhost:3000/logs?level=error&limit=50
```

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health check |
| `/metrics` | GET | System metrics and statistics |
| `/logs` | GET | View system logs |
| `/config/:key` | GET | Get configuration value |
| `/config` | POST | Set configuration value |
| `/status` | GET | System status overview |

## 🔧 PM2 Commands

### Start System
```bash
npm run pm2
```

### View Logs
```bash
npm run pm2:logs
```

### Restart System
```bash
npm run pm2:restart
```

### Stop System
```bash
npm run pm2:stop
```

### Delete from PM2
```bash
npm run pm2:delete
```

## 🔒 Security Considerations

- **Session Security**: WhatsApp session data is stored securely in `sessions/` directory
- **Input Validation**: All Excel data is validated before processing
- **Rate Limiting**: Prevents abuse and WhatsApp bans
- **Error Handling**: Comprehensive error handling to prevent information leakage
- **Environment Variables**: Sensitive configuration stored in environment variables

## 🚀 Production Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/whatsapp-reminder.service`:

```ini
[Unit]
Description=WhatsApp Reminder System
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/whatsapp-reminder-system
Environment=NODE_ENV=production
ExecStart=/usr/bin/pm2 start ecosystem.config.js
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 stop all
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service
```bash
sudo systemctl enable whatsapp-reminder
sudo systemctl start whatsapp-reminder
```

### Monitoring
```bash
sudo systemctl status whatsapp-reminder
journalctl -u whatsapp-reminder -f
```

## 📊 Monitoring and Alerts

### Log Monitoring
- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`
- Info logs: `logs/info.log`

### Metrics to Monitor
- System uptime
- Messages sent per hour
- WhatsApp connection status
- Excel files processed
- Error rates

### Alert Thresholds
- WhatsApp disconnection > 5 minutes
- Error rate > 5% in 1 hour
- No messages sent in 2 hours
- High memory usage > 80%

## 🧹 Backup and Recovery

### Database Backup
```bash
# Manual backup
cp database.sqlite data/backups/database-$(date +%Y%m%d-%H%M%S).sqlite

# Automatic backup (add to cron)
0 2 * * * /usr/bin/cp database.sqlite data/backups/database-$(date +%Y%m%d).sqlite
```

### Session Backup
```bash
cp -r sessions data/backups/sessions-$(date +%Y%m%d)
```

### Restore Process
1. Stop the system: `npm run pm2:stop`
2. Restore database: `cp backup.sqlite database.sqlite`
3. Restore sessions: `cp -r backup-sessions sessions/`
4. Start the system: `npm run pm2:start`

## 🔄 Maintenance

### Daily Tasks
- Check system logs for errors
- Verify WhatsApp connection status
- Monitor message delivery rates

### Weekly Tasks
- Review system metrics
- Clean up old processed files
- Update configuration if needed
- Database optimization (vacuum)

### Monthly Tasks
- Full system backup
- Review security updates
- Performance optimization
- Update dependencies

## 🔍 Troubleshooting

### Common Issues

#### 1. WhatsApp Not Connecting
```bash
# Check logs
npm run pm2:logs

# Restart service
npm run pm2:restart

# Check session file
ls -la sessions/
```

#### 2. No Messages Being Sent
```bash
# Check rate limits
curl http://localhost:3000/metrics

# Check Excel files
ls -la data/excel/

# Check database
sqlite3 database.sqlite "SELECT COUNT(*) FROM records;"
```

#### 3. High Memory Usage
```bash
# Restart PM2
npm run pm2:restart

# Check logs for memory leaks
npm run pm2:logs | grep -i memory
```

#### 4. Excel File Processing Errors
```bash
# Validate Excel file
node -e "const ExcelJS = require('exceljs'); new ExcelJS.Workbook().xlsx.readFile('data/excel/yourfile.xlsx')"

# Check file permissions
ls -la data/excel/
```

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check verbose output
npm run dev
```

## 📈 Performance Metrics

### Expected Performance
- **Excel Processing**: 100-500 records per minute
- **Message Sending**: 5-10 messages per minute (rate limited)
- **Database Operations**: < 100ms for most queries
- **Memory Usage**: 50-150MB (stable)
- **CPU Usage**: < 5% under normal load

### Monitoring Endpoints
```bash
# Current system status
curl http://localhost:3000/status

# Detailed metrics
curl http://localhost:3000/metrics

# Recent logs
curl http://localhost:3000/logs?limit=20
```

## 🔄 Updates and Maintenance

### Update Dependencies
```bash
npm update
npm run pm2:restart
```

### Database Migration
```bash
# Backup first
cp database.sqlite data/backups/

# Run migrations (if any)
node src/migrations/update-1.0.0.js
```

### System Upgrade
```bash
# Pull latest changes
git pull origin main

# Install updates
npm install

# Restart services
npm run pm2:restart
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the logs for error details

---

**Built with ❤️ for automated WhatsApp reminders**

*Last updated: March 2026*