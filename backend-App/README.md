# KedaiPOS - Backend API

Backend API untuk aplikasi Point of Sale (POS) yang dibangun dengan Laravel 12.

## 🚀 Tech Stack

- **Laravel 12** - PHP Framework
- **Laravel Sanctum** - API Authentication
- **SQLite/MySQL** - Database
- **PHP 8.2+** - Programming Language

## 📋 Prerequisites

- **PHP** 8.2 atau lebih tinggi
- **Composer** - PHP Dependency Manager
- **Database**: MySQL, PostgreSQL, atau SQLite

## 🔧 Installation

```bash
# Install dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database di .env file
# Untuk SQLite (default):
# DB_CONNECTION=sqlite / mysql
# Untuk MySQL:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=kedai_pos
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

## 🌐 Environment Configuration

File `.env` utama yang perlu dikonfigurasi:

```env
APP_NAME=KedaiPOS
APP_ENV=local
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost:8000

# Database Configuration
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=kedai_pos
DB_USERNAME=root
DB_PASSWORD=

# Session & Cache
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

# CORS Configuration (untuk frontend)
SANCTUM_STATEFUL_DOMAINS=localhost:5173
```

## 📁 Project Structure

```
backend-App/
├── app/
│   ├── Http/
│   │   └── Controllers/
│   │       └── Api/
│   │           ├── AuthController.php
│   │           ├── OrderController.php
│   │           ├── MenuController.php
│   │           ├── InventoryController.php
│   │           ├── EmployeeController.php
│   │           ├── CapitalController.php
│   │           └── StoreController.php
│   └── Models/
│       ├── User.php
│       ├── Order.php
│       ├── Menu.php
│       ├── Inventory.php
│       ├── Employee.php
│       ├── Capital.php
│       └── Store.php
├── database/
│   ├── migrations/
│   └── seeders/
├── routes/
│   └── api.php
└── config/
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

## 🗄️ Database Management

```bash
# Create new migration
php artisan make:migration create_table_name

# Run migrations
php artisan migrate

# Rollback last migration
php artisan migrate:rollback

# Reset database
php artisan migrate:fresh

# Seed database
php artisan db:seed
```

## 🔐 Authentication

API menggunakan **Laravel Sanctum** untuk authentication:
- Token-based authentication
- CORS support untuk frontend React
- Stateful authentication untuk SPA

## 🚀 Production Build

```bash
# Install dependencies (production)
composer install --optimize-autoloader --no-dev

# Cache configuration
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Optimize autoloader
composer dump-autoload --optimize
```

## 📝 Development Notes

- Semua API routes ada di `routes/api.php`
- Controllers ada di `app/Http/Controllers/Api/`
- Models menggunakan Eloquent ORM
- Database migrations ada di `database/migrations/`
- Gunakan `php artisan serve` untuk development server

---

**Catatan**: Untuk dokumentasi lengkap proyek, lihat README.md di root folder `POS-APP/`
