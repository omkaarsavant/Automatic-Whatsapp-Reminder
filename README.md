# 📱 WhatsApp Reminder System for LIC Premiums

A premium, production-ready automation system designed to manage LIC premium reminders. It reads data directly from Excel files, handles complex scheduling (0, 2, and 5 days before due date), and operates entirely on **Indian Standard Time (IST)**.

---

## ✨ Key Features

- **🕒 Unified IST Synchronization**: Fully compliant with `Asia/Kolkata` time across the database, scheduler, and dashboard. No timezone shifts!
- **⚡ Instant Auto-Send**: Automatically triggers message checks the moment you save your Excel file (5s debounce).
- **📋 Planning to Send (Queue)**: A live dashboard section showing messages prepared and waiting for the next trigger.
- **📱 Termux Optimized**: 100% free hosting on Android phones with automated setup and 24/7 background persistence.
- **🔄 Auto-Resume Logic**: Automatically detects network recovery and instantly catches up on any missed reminders.
- **📅 Smart Milestones**: Sends reminders exactly **5 days before**, **2 days before**, and **on the due date**.
- **📊 Premium Dashboard**: Real-time stats, interactive charts, and scrollable logs for full transparency.

---

## 🛠️ Technical Stack

- **Core**: Node.js 18+
- **WhatsApp**: [Baileys](https://github.com/WhiskeySockets/Baileys) (Multi-device protocol)
- **Database**: SQLite (Local persistence)
- **Scheduling**: node-cron + custom real-time watcher
- **Frontend**: Vanilla JS + CSS (Glassmorphism design)
- **Process Management**: PM2

---

## 📦 Installation & Setup

### 1. Prerequisites
- Node.js installed on your PC or Termux on Android.
- WhatsApp account for scanning the QR code.

### 2. Windows Setup
```bash
# Clone and install
npm install

# Setup directories
npm run setup

# Start the system
npm start
```

### 3. Android (Termux) Setup
1. Transfer the project to your phone.
2. Install **Termux** (via F-Droid).
3. Run the automated setup:
   ```bash
   chmod +x termux-setup.sh
   ./termux-setup.sh
   ```
4. Start 24/7 background service:
   ```bash
   pm2 start src/index.js --name bot
   pm2 save
   ```

---

## 📁 Excel Format (data/excel/)

The system monitors this directory for `.xlsx` files with these columns:

| Column | Description |
| :--- | :--- |
| **Policy Number** | Unique LIC Policy ID |
| **Customer Name** | Full name of the client |
| **Phone Number** | 10-digit mobile number (autodetects +91) |
| **Premium Amount** | Amount due in INR |
| **Due Date** | Premium due date (DD/MM/YYYY) |

---

## 📊 Monitoring

- **Dashboard**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`
- **Logs**: `pm2 logs bot` (in Termux/PM2)

---

## 🔒 Safety & Stability
- **Deduplication**: Never sends the same reminder type twice on the same day.
- **Rate Limiting**: Intelligent delays between messages to prevent WhatsApp flagging.
- **Wakelock Support**: Integrated instructions for Termux to prevent Android from killing the process.

---

**Built with ❤️ for reliable LIC automation.**
*Last updated: March 2026*