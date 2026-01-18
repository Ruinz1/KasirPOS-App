# KedaiPOS-App

Aplikasi Point of Sale (POS) modern untuk manajemen kedai/toko dengan fitur lengkap untuk kasir, inventory, karyawan, dan laporan keuangan.

## 🚀 Tech Stack

### Backend
- **Laravel 12** - PHP Framework
- **Laravel Sanctum** - API Authentication
- **SQLite/MySQL** - Database

### Frontend
- **React 18** - UI Library
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **TanStack Query** - Data Fetching & Caching
- **Zustand** - State Management
- **Radix UI** - Headless UI Components
- **Tailwind CSS** - Styling
- **Recharts** - Data Visualization

## ✨ Fitur Utama

### 🛒 Sistem POS (Point of Sale)
- Interface kasir yang user-friendly
- Order type: Dine In / Take Away
- Discount & Tax calculation
- Payment tracking (Paid Amount & Change)
- Receipt printing (58mm thermal printer support)

### 📦 Inventory Management
- Stock tracking real-time
- Damaged equipment handling
- Stock alerts & notifications
- Category management

### 👥 Employee Management
- Role-based access control
- Salary tracking & management
- Employee performance monitoring

### 💰 Capital & Financial Tracking
- Initial capital management
- Revenue & expense tracking
- Profit/Loss calculation
- Financial reports & analytics

### 📊 Reports & Analytics
- Sales trend visualization
- Transaction history
- Revenue reports
- Receipt printing & viewing

### 🏪 Multi-Store Support
- Multiple store management
- Store switching
- Per-store analytics

### 🍽️ Menu Management
- Menu item CRUD operations
- Pricing & discount management
- Category organization
- Stock integration

## 📁 Project Structure

```
KedaiPOS-App/
├── backend-App/          # Laravel 12 API Backend
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── AuthController.php
│   │   │   ├── OrderController.php
│   │   │   ├── MenuController.php
│   │   │   ├── InventoryController.php
│   │   │   ├── EmployeeController.php
│   │   │   ├── CapitalController.php
│   │   │   ├── StoreController.php
│   │   │   └── ...
│   │   └── Models/
│   ├── database/migrations/
│   ├── routes/api.php
│   └── ...
│
└── frontend-app/         # React + TypeScript Frontend
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   │   ├── POSPage.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── InventoryPage.tsx
    │   │   ├── MenuPage.tsx
    │   │   ├── EmployeesPage.tsx
    │   │   ├── ReportsPage.tsx
    │   │   └── ...
    │   ├── store/
    │   ├── hooks/
    │   └── utils/
    └── ...
```

## 🔧 Prerequisites

- **PHP** 8.2 atau lebih tinggi
- **Composer** - PHP Dependency Manager
- **Node.js** 18+ dan npm
- **Database**: MySQL, PostgreSQL, atau SQLite
- **POS Printer** (Optional) - Thermal printer 58mm untuk receipt printing

## 📦 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd KedaiPOS-App
```

### 2. Backend Setup (Laravel)

```bash
cd backend-App

# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database di .env file
# Untuk SQLite (default):
# DB_CONNECTION=sqlite
# Untuk MySQL:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=kedaipos
# DB_USERNAME=root
# DB_PASSWORD=

# Run migrations
php artisan migrate

# (Optional) Seed database dengan data sample
php artisan db:seed

# Start development server
php artisan serve
```

Backend akan berjalan di `http://localhost:8000`

### 3. Frontend Setup (React + Vite)

```bash
cd frontend-app

# Install dependencies
npm install

# (Optional) Configure API URL di .env file jika berbeda
# VITE_API_URL=http://localhost:8000

# Start development server
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

## 🔐 Environment Configuration

### Backend (.env)

```env
APP_NAME=KedaiPOS
APP_ENV=local
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database Configuration
DB_CONNECTION=sqlite
# atau untuk MySQL:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=kedaipos
# DB_USERNAME=root
# DB_PASSWORD=

# Session & Cache
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

## 🚀 Development Workflow

### Running Development Servers

**Backend:**
```bash
cd backend-App
php artisan serve
```

**Frontend:**
```bash
cd frontend-app
npm run dev
```

### Building for Production

**Backend:**
```bash
cd backend-App
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

**Frontend:**
```bash
cd frontend-app
npm run build
# Output akan ada di folder dist/
```

### Database Migrations

```bash
# Create new migration
php artisan make:migration create_table_name

# Run migrations
php artisan migrate

# Rollback last migration
php artisan migrate:rollback

# Reset database
php artisan migrate:fresh
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get authenticated user

### Orders (POS)
- `GET /api/orders` - Get all orders
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order detail
- `PUT /api/orders/{id}` - Update order
- `DELETE /api/orders/{id}` - Delete order

### Menu
- `GET /api/menu` - Get all menu items
- `POST /api/menu` - Create menu item
- `PUT /api/menu/{id}` - Update menu item
- `DELETE /api/menu/{id}` - Delete menu item

### Inventory
- `GET /api/inventory` - Get inventory items
- `POST /api/inventory` - Add inventory item
- `PUT /api/inventory/{id}` - Update inventory
- `POST /api/inventory/damage` - Record damaged item

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create employee
- `PUT /api/employees/{id}` - Update employee
- `DELETE /api/employees/{id}` - Delete employee

### Capital & Finance
- `GET /api/capital` - Get capital data
- `POST /api/capital` - Add capital entry
- `GET /api/capital/profit-loss` - Get profit/loss report

### Reports
- `GET /api/reports/sales` - Sales reports
- `GET /api/reports/transactions` - Transaction history
- `GET /api/reports/revenue` - Revenue reports

### Stores
- `GET /api/stores` - Get all stores
- `POST /api/stores` - Create store
- `PUT /api/stores/{id}` - Update store

## 🖨️ POS Printer Setup

Aplikasi ini mendukung thermal printer 58mm untuk mencetak receipt. 

1. Install driver printer (gunakan `POS Printer Driver Setup.exe` jika tersedia)
2. Pastikan printer terhubung via USB atau Bluetooth
3. Konfigurasi printer di sistem operasi
4. Receipt akan otomatis terformat untuk kertas 58mm

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👨‍💻 Developer

Developed with ❤️ for modern retail businesses

---

**KedaiPOS-App** - Solusi POS Modern untuk Kedai Anda
