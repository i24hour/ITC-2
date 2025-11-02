# ITC Warehouse Management System - Frontend

## 📋 Overview

A modern, professional web-based warehouse management system for ITC that digitizes and automates SKU tracking, bin management, and FIFO dispatch operations.

## ✨ Features

### 🔐 Authentication
- Login and Signup pages
- Session management with localStorage
- Secure user authentication

### 📊 Dashboard
- Quick action cards (Incoming, Outgoing, Reports)
- Task history with completion status
- Expiry reminders with urgency indicators
- Quick statistics overview

### 📥 Incoming Inventory
- **Step 1**: Enter SKU details (SKU, quantity, weight)
- **Step 2**: Smart bin selection
  - View partially filled bins with same SKU
  - View empty bins
  - Select multiple bins until capacity is met
- **Step 3**: QR code scanning confirmation
  - Live camera scanning using html5-qrcode
  - Real-time bin status (pending/scanned)
  - Database updates on scan

### 📤 Outgoing Inventory (FIFO)
- **Step 1**: Search SKU and enter dispatch quantity
- **Step 2**: Automatic FIFO bin selection
  - System auto-selects oldest bins first
  - Shows bin age and dates
  - Ensures First-In-First-Out compliance
- **Step 3**: QR code scanning for dispatch confirmation
  - Live camera scanning
  - Tracks dispatch progress
  - Updates inventory automatically

### 📈 Reports & Analytics
- Customizable date ranges and report types
- Summary cards for incoming/outgoing/stock/bins
- Activity log table
- SKU inventory status with expiry alerts
- CSV export functionality
- Chart placeholders for future integration

## 🎨 Design

### Theme
- **Primary Colors**: Professional blue gradient (#667eea to #764ba2)
- **Status Colors**: 
  - Success: Green (#10b981)
  - Warning: Orange (#f59e0b)
  - Danger: Red (#ef4444)
  - Info: Blue (#3b82f6)

### Features
- Modern, clean design
- Responsive layout for mobile/tablet/desktop
- Smooth animations and transitions
- Professional card-based UI
- Consistent color scheme throughout

## 📁 File Structure

```
d:\SIMPI\ITC\
├── package.json              # Node.js dependencies
├── server.js                 # Express backend server
├── inventory_data.csv        # CSV inventory data
└── public/                   # Frontend files
    ├── index.html            # Login/Signup page
    ├── dashboard.html        # Main dashboard
    ├── incoming.html         # Incoming inventory flow
    ├── outgoing.html         # Outgoing inventory flow (FIFO)
    ├── reports.html          # Reports and analytics
    ├── styles.css            # Main stylesheet
    ├── auth.js               # Authentication logic
    ├── dashboard.js          # Dashboard functionality
    ├── incoming.js           # Incoming flow logic
    ├── outgoing.js           # Outgoing FIFO logic
    └── reports.js            # Reports functionality
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)
- Webcam/camera for QR scanning

### Installation

1. **Navigate to project directory:**
   ```bash
   cd d:\SIMPI\ITC
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   # Production mode
   npm start

   # Development mode (auto-restart on changes)
   npm run dev
   ```

4. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 🔧 Configuration

### Backend API Endpoints (To be implemented)

The frontend expects the following API endpoints from `server.js`:

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/signup` - User registration

#### Bins
- `GET /api/bins/available?sku={sku}` - Get available bins for SKU
- `GET /api/bins/fifo?sku={sku}` - Get bins in FIFO order
- `POST /api/bins/update` - Update bin after incoming
- `POST /api/bins/dispatch` - Dispatch bin for outgoing

#### Reports
- `GET /api/reports/summary` - Get dashboard summary
- `GET /api/reports?range={range}&type={type}` - Get filtered reports
- `GET /api/reports/activity` - Get activity log
- `GET /api/reports/sku-inventory` - Get SKU inventory status

## 🎯 Usage Flow

### Incoming Flow
1. Login to the system
2. Click "Incoming" from dashboard
3. Enter SKU, quantity, and weight
4. System shows available bins (partial + empty)
5. Select bins until total capacity ≥ incoming quantity
6. Scan each bin's QR code to confirm
7. System updates database and marks as complete

### Outgoing Flow (FIFO)
1. Login to the system
2. Click "Outgoing" from dashboard
3. Enter SKU and dispatch quantity
4. System automatically selects oldest bins (FIFO)
5. Review auto-selected bins
6. Scan each bin's QR code to confirm dispatch
7. System updates inventory and reduces bin count

## 📱 QR Code Scanning

The system uses **html5-qrcode** library for live camera scanning:
- Automatically detects available cameras
- Real-time QR code detection
- Switch between front/back cameras
- Works on mobile and desktop browsers

### Browser Permissions
- Grant camera access when prompted
- HTTPS required for camera access (or localhost)

## 🔒 Security Notes

### Current Implementation
- Uses `localStorage` for session management
- Basic authentication flow (for demo)

### Production Recommendations
- Implement proper JWT authentication
- Use secure HTTP-only cookies
- Add password hashing (bcrypt)
- Implement CSRF protection
- Add rate limiting
- Use HTTPS in production
- Store sensitive data server-side

## 🌐 Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 📦 Dependencies

### Backend
- `express` - Web server framework
- `cors` - Cross-origin resource sharing
- `csv-parser` - Parse CSV inventory data
- `qrcode` - Generate QR codes
- `nodemon` - Development auto-restart

### Frontend
- `html5-qrcode` - QR code scanning (CDN)

## 🎨 Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #2563eb;
    --success-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
}
```

### Branding
- Replace ITC logo placeholder in header
- Update company name in `index.html`
- Modify gradient colors to match brand

## 🚧 TODO / Future Enhancements

### High Priority
- [ ] Connect to backend API endpoints
- [ ] Implement real database integration
- [ ] Add proper user authentication (JWT)
- [ ] Implement bin QR code generation

### Features
- [ ] Add search/filter in reports
- [ ] Integrate Chart.js for analytics
- [ ] Add print functionality for reports
- [ ] Implement email notifications for expiries
- [ ] Add user roles (admin, operator, viewer)
- [ ] Multi-warehouse support
- [ ] Barcode scanning support
- [ ] Mobile app version

### UI/UX
- [ ] Add loading spinners
- [ ] Improve error handling
- [ ] Add toast notifications
- [ ] Implement dark mode
- [ ] Add keyboard shortcuts

## 🐛 Known Issues

1. **Camera Access**: Some browsers require HTTPS for camera access
2. **localStorage**: Data is not persistent across browsers
3. **Mock Data**: Currently using hardcoded data, needs API integration

## 📄 License

Proprietary - ITC Company

## 👥 Authors

- Frontend Development Team

## 📞 Support

For issues or questions, contact the development team.

---

**Last Updated**: October 28, 2025
