const fs = require('fs');
const path = require('path');

const logPath = 'd:/Reminder/logs/combined.log';
if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(lines.slice(-100).join('\n'));
} else {
  console.log('Log file not found');
}
