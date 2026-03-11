const fs = require('fs');
const path = require('path');

// Create required directories
const directories = [
  'data/excel',
  'data/backups',
  'logs',
  'logs/sessions',
  'sessions'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Create example Excel file
const exampleExcelPath = path.join(__dirname, 'data/excel/example-input.xlsx');
if (!fs.existsSync(exampleExcelPath)) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Premiums');

  worksheet.columns = [
    { header: 'Policy Number', key: 'policy_number', width: 20 },
    { header: 'Customer Name', key: 'customer_name', width: 20 },
    { header: 'Phone Number', key: 'phone_number', width: 15 },
    { header: 'Premium Amount', key: 'premium_amount', width: 15 },
    { header: 'Due Date', key: 'due_date', width: 15 },
    { header: 'Policy Status', key: 'policy_status', width: 15 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'Policy Type', key: 'policy_type', width: 20 },
    { header: 'Premium Frequency', key: 'premium_frequency', width: 20 },
    { header: 'Last Payment Date', key: 'last_payment_date', width: 20 },
    { header: 'Next Due Date', key: 'next_due_date', width: 20 }
  ];

  // Add sample data
  const sampleData = [
    {
      policy_number: 'LIC12345678',
      customer_name: 'John Doe',
      phone_number: '9876543210',
      premium_amount: 5000,
      due_date: '15/03/2026',
      policy_status: 'Active',
      email: 'john.doe@example.com',
      policy_type: 'Endowment',
      premium_frequency: 'Monthly',
      last_payment_date: '15/02/2026',
      next_due_date: '15/04/2026'
    },
    {
      policy_number: 'LIC87654321',
      customer_name: 'Jane Smith',
      phone_number: '9876543211',
      premium_amount: 7500,
      due_date: '20/03/2026',
      policy_status: 'Active',
      email: 'jane.smith@example.com',
      policy_type: 'Money Back',
      premium_frequency: 'Quarterly',
      last_payment_date: '20/12/2025',
      next_due_date: '20/06/2026'
    },
    {
      policy_number: 'LIC11223344',
      customer_name: 'Bob Johnson',
      phone_number: '9876543212',
      premium_amount: 10000,
      due_date: '025/03/2026',
      policy_status: 'Active',
      email: 'bob.johnson@example.com',
      policy_type: 'Whole Life',
      premium_frequency: 'Yearly',
      last_payment_date: '025/03/2025',
      next_due_date: '025/03/2027'
    }
  ];

  sampleData.forEach((data, index) => {
    const row = worksheet.getRow(index + 2);
    row.values = [
      data.policy_number,
      data.customer_name,
      data.phone_number,
      data.premium_amount,
      data.due_date,
      data.policy_status,
      data.email,
      data.policy_type,
      data.premium_frequency,
      data.last_payment_date,
      data.next_due_date
    ];
  });

  workbook.xlsx.writeFile(exampleExcelPath)
    .then(() => {
      console.log('Created example Excel file: data/excel/example-input.xlsx');
    })
    .catch(err => {
      console.error('Error creating example file:', err);
    });
}

console.log('Setup completed successfully!');
console.log('Ready to start the WhatsApp Reminder System.');
console.log('Run: npm start or npm run pm2');
console.log('Place your Excel files in: data/excel/');
console.log('For help: npm run help');