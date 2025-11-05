# 📦 SKU Inventory Management System

🌐 **Live Application**: [https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net](https://itc-warehouse-app-2025-c8hgg5deeagae5dj.centralindia-01.azurewebsites.net)

A web-based inventory management system with QR code scanning functionality for managing SKU bin assignments.

## Features

- **Search by SKU**: Find all bins containing more than a specified quantity of a SKU
- **QR Code Generation**: Generate scannable QR codes for inventory operations
- **Mobile Scanning**: Scan QR codes with your phone to subtract inventory values
- **Real-time Updates**: Computer screen automatically detects when phone scan completes
- **CSV Storage**: All inventory data stored in `inventory_data.csv`

## Requirements

- Node.js installed on your computer
- Computer and phone on the **same WiFi network**

## Installation

```bash
npm install
```

## Running the Application

```bash
npm start
```

The server will display your network URL for accessing from different devices.

## How to Use

### 1. Search for Bins

1. Open the application URL
2. Select a SKU from the dropdown
3. Enter a minimum value (e.g., 10)
4. Click "Search Bins"
5. View all bins that have MORE than the specified value

### 2. Generate QR Code

1. Click on any bin card from the search results
2. A modal will open showing:
   - Bin information
   - QR code
   - "Waiting for scan..." message

### 3. Scan with Phone

1. Open your phone's camera or QR scanner app
2. Scan the QR code displayed on your computer
3. Your phone will automatically:
   - Open a scan processing page
   - Subtract the specified value from the bin
   - Update the CSV file
   - Show success confirmation

### 4. Computer Auto-Detection

- While you're scanning with your phone, your computer is polling every 2 seconds
- When the scan completes, your computer screen will automatically show:
  - ✅ Success message
  - Scan details (previous value, subtracted amount, new value)
  - "Return to Home" button

### 5. Return to Home

- Click "Return to Home" on your computer
- The form resets and you're ready for the next operation

## File Structure

```
0or1/
├── server.js              # Express backend server
├── package.json           # Dependencies
├── inventory_data.csv     # Inventory data storage
├── public/
│   ├── index.html        # Main web interface
│   ├── scan.html         # Mobile scan processing page
│   ├── styles.css        # Styling
│   └── app.js            # Frontend JavaScript
└── README.md             # This file
```

## Technology Stack

- **Backend**: Node.js, Express
- **QR Codes**: qrcode library
- **CSV Handling**: csv-parser
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Important Notes

- **WiFi Requirement**: Your phone must be on the same network as your computer
- **Polling**: The computer checks for scan completion every 2 seconds
- **Bin Restriction**: Each bin can only contain one SKU at a time
- **Value Subtraction**: Scans will subtract the specified value (won't go below 0)

## Troubleshooting

### QR Code doesn't work on phone

- Ensure both devices are on the same WiFi network
- Check the Network URL shown in the terminal matches your computer's IP
- Try accessing the Network URL directly in your phone's browser

### Computer doesn't detect scan

- The polling checks every 2 seconds - be patient
- Check that the CSV file is being updated
- Ensure no errors in the browser console (F12)

## Future Enhancements

- WebSocket support for instant updates (instead of polling)
- User authentication
- Barcode scanning support
- Transaction history log
- Multiple warehouse support

