# KedaiPOS - Frontend Application

Frontend aplikasi Point of Sale (POS) modern yang dibangun dengan React, TypeScript, dan Vite.

## 🚀 Tech Stack

- **React 18** - UI Library
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **TanStack Query** - Data Fetching & Caching
- **Zustand** - State Management
- **Radix UI** - Headless UI Components
- **Tailwind CSS** - Styling
- **Recharts** - Data Visualization

## 📋 Prerequisites

- **Node.js** 18+ dan npm
- Backend API harus sudah berjalan di `http://localhost:8000`

## 🔧 Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

## 🌐 Environment Configuration

Buat file `.env` di root folder `frontend-app/`:

```env
VITE_API_URL=http://localhost:8000
```

## 📦 Build for Production

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview
```

Output akan ada di folder `dist/`

## 📁 Project Structure

```
frontend-app/
├── src/
│   ├── components/       # Reusable components
│   │   ├── layout/      # Layout components (Sidebar, Navbar)
│   │   └── ui/          # UI components (Button, Card, etc)
│   ├── pages/           # Page components
│   │   ├── POSPage.tsx
│   │   ├── Dashboard.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── MenuPage.tsx
│   │   ├── EmployeesPage.tsx
│   │   ├── ReportsPage.tsx
│   │   ├── CapitalPage.tsx
│   │   └── StorePage.tsx
│   ├── store/           # Zustand state management
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point
├── public/              # Static assets
└── package.json
```

## 🎯 Main Features

- **POS Interface** - User-friendly kasir dengan order type (Dine In/Take Away)
- **Dashboard** - Analytics dan sales trend visualization
- **Inventory Management** - Stock tracking dan damaged equipment handling
- **Menu Management** - CRUD menu items dengan category
- **Employee Management** - Role-based access dan salary tracking
- **Capital & Finance** - Profit/loss calculation dan financial reports
- **Reports** - Transaction history dan receipt printing
- **Multi-Store** - Multiple store management

## 🔗 API Integration

Frontend berkomunikasi dengan backend Laravel melalui REST API. Pastikan backend sudah berjalan sebelum menjalankan frontend.

Default API URL: `http://localhost:8000`

## 📝 Development Notes

- Gunakan `npm run dev` untuk development dengan hot-reload
- Semua API calls menggunakan TanStack Query untuk caching dan state management
- State global dikelola dengan Zustand
- Styling menggunakan Tailwind CSS dengan custom components

---

**Catatan**: Untuk dokumentasi lengkap proyek, lihat README.md di root folder `POS-APP/`
