# Team Tracker Dashboard – Phase 1 MVP

A full-stack enterprise Team Tracker Dashboard built with React + TypeScript, Node.js + Express, Prisma ORM, Azure Database for PostgreSQL, and Azure Blob Storage.

## 🚀 Project Structure

```
Tracker/
├── frontend/    # React + TypeScript + Vite + Tailwind + shadcn/ui + Recharts
└── backend/     # Node.js + Express + TypeScript + Prisma ORM
```

## ⚙️ Prerequisites

- Node.js v20 or v22 LTS ([nodejs.org](https://nodejs.org))
- Git ([git-scm.com](https://git-scm.com))
- A PostgreSQL 16 database — production uses [Supabase](https://supabase.com)
- Azure Blob Storage Account

## 🔧 Environment Setup

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres"
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=..."
AZURE_STORAGE_ACCOUNT_NAME="your-storage-account"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

### Frontend (`frontend/.env`)

Create `frontend/.env.local` (optional):

```env
# Only needed if the backend is not on the default port. The client appends paths like
# /members to this value, so it must include the /api prefix — without it every request
# 404s against a backend that is plainly reachable, which is a confusing way to start.
# Leave this unset to use the Vite dev proxy, which already works for local development.
VITE_API_URL=http://localhost:3001/api
```

## 📦 Installation & Running

### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy        # First time: creates tables in PostgreSQL
npm run seed                     # Load sample data
npm run dev                      # Start backend on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev                      # Start frontend on http://localhost:5173
```

## 🗄️ Database Setup (Supabase PostgreSQL)

1. Go to the [Supabase dashboard](https://supabase.com/dashboard) and create a project
2. Open **Project Settings → Database** and copy the connection string
3. Set both `DATABASE_URL` and `DIRECT_URL` in `backend/.env` — `schema.prisma`
   declares `directUrl`, and Prisma uses it for migrations and other DDL. Prefer
   the direct/session connection for `DIRECT_URL`; the transaction pooler can
   stall admin queries.
4. Run `npx prisma migrate deploy` to create tables

Any PostgreSQL 16 instance works for local development — nothing in the schema is
Supabase-specific. Production happens to run on Supabase (`ap-northeast-1`).

> **Already have a populated database?** The migration history was squashed to a
> single `0_init` baseline. Existing databases need a one-time
> `npx prisma migrate resolve --applied 0_init` before the next deploy — see
> [`backend/prisma/migrations/README.md`](backend/prisma/migrations/README.md).

## ☁️ Azure Blob Storage Setup

1. Go to Azure Portal → Storage Account → Containers
2. Create 4 containers:
   - `certificates`
   - `profile-images`
   - `project-documents`
   - `reports`
3. Copy the connection string to `backend/.env`

## 🚀 Azure Deployment

### Backend → Azure App Service

```bash
cd backend
npm run build
# Deploy dist/ to Azure App Service
# Set environment variables in App Service → Configuration
```

### Frontend → Azure Static Web Apps

```bash
cd frontend
npm run build
# Deploy dist/ to Azure Static Web Apps
# Update staticwebapp.config.json with your App Service URL
```

## 📋 Features

- ✅ Dashboard with KPI cards, charts, and widgets
- ✅ Team Members CRUD + profile pictures (Azure Blob)
- ✅ Certification Catalog CRUD
- ✅ Certification Assignment & Tracker with progress bars
- ✅ Certificate upload to Azure Blob Storage
- ✅ Project Management CRUD with member assignment
- ✅ Deadline Tracker (Overdue / Today / Week / Upcoming)
- ✅ Notifications system
- ✅ Global Search across members, certs, projects
- ✅ Reports Export (PDF / Excel / CSV)
- ✅ Fully responsive Azure Fluent-inspired UI
- ✅ Auto-refresh after every CRUD operation

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | KPI statistics |
| GET/POST/PUT/DELETE | `/api/members` | Team Members CRUD |
| GET/POST/PUT/DELETE | `/api/certifications` | Cert Catalog CRUD |
| POST | `/api/certifications/assign` | Assign cert to member |
| GET/PUT | `/api/certifications/assignments/all` | Tracker with filters |
| POST | `/api/certifications/assignments/:id/certificate` | Upload certificate |
| GET/POST/PUT/DELETE | `/api/projects` | Projects CRUD |
| GET | `/api/notifications` | Notifications |
| GET | `/api/search?q=...` | Global search |
| GET | `/api/reports/team?format=pdf\|excel\|csv` | Reports |
