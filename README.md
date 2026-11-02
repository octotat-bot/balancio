# Balancio

An expense splitting app for tracking shared costs with friends and groups, with real-time updates and member-to-member balances.

**Live demo:** https://balancio-three.vercel.app

## Features

- 🔐 **Authentication** - Login/Signup with JWT authentication
- 📊 **Dashboard** - Overview of your balances and recent activity
- 👥 **Groups** - Create and manage expense groups
- 💰 **Expenses** - Add expenses with multiple split types
- ⚖️ **Balances** - Track who owes whom, member to member
- 🤝 **Friends** - Friend requests, direct expenses and settlements outside groups
- 💬 **Group chat and notifications** - Real-time updates over Socket.io
- 👤 **Profile** - Manage your account settings

## Tech Stack

**Frontend:**
- React + Vite
- Framer Motion
- Zustand (state management)
- Socket.io client
- React Router
- React Hook Form + Zod

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- bcryptjs
- Socket.io

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Installation

1. Clone the repository

2. Install frontend dependencies:
```bash
cd client
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
```

4. Create environment file:
```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
```

### Running the Application

**Start the backend:**
```bash
cd server
npm run dev
```

**Start the frontend (in a new terminal):**
```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── stores/         # Zustand stores
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   └── package.json
│
├── server/                 # Express backend
│   ├── models/             # Mongoose models
│   ├── controllers/        # Route controllers
│   ├── routes/             # API routes
│   ├── middleware/         # Auth middleware
│   └── package.json
│
└── README.md
```

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Groups
- `GET /api/groups` - Get all groups
- `POST /api/groups` - Create group
- `GET /api/groups/:id` - Get group
- `PUT /api/groups/:id` - Update group
- `DELETE /api/groups/:id` - Delete group

### Expenses
- `GET /api/groups/:id/expenses` - Get expenses
- `POST /api/groups/:id/expenses` - Create expense
- `PUT /api/groups/:id/expenses/:expenseId` - Update expense
- `DELETE /api/groups/:id/expenses/:expenseId` - Delete expense

## License

MIT
