# Taskmaster - Personal Productivity Dashboard

A real-time dashboard for managing tasks, notes, time tracking, and projects. Built with Next.js, PostgreSQL, and Docker.

## Features

- Task management with subtasks
- Project progress tracking
- Time tracking and logging
- Notes with markdown support
- Real-time updates
- GitHub OAuth authentication
- Self-hosted on your NAS

## Quick Start

### Development on Fedora

1. **Clone the repo:**
```bash
   git clone https://github.com/ShubhankerS/taskmaster.git
   cd taskmaster
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Set up environment:**
```bash
   cp .env.example .env.local
   # Edit .env.local with your values
```

4. **Start PostgreSQL with Docker:**
```bash
   docker-compose up postgres -d
```

5. **Run the dev server:**
```bash
   npm run dev
```

   Open [http://localhost:3000](http://localhost:3000)

### Deployment on NAS

1. **Clone on NAS:**
```bash
   git clone https://github.com/ShubhankerS/taskmaster.git
   cd taskmaster
```

2. **Set up environment:**
```bash
   cp .env.example .env.local
   # Edit .env.local with your NAS domain and credentials
```

3. **Run with Docker Compose:**
```bash
   docker-compose up -d
```

4. **Point your domain to your NAS IP**

## Environment Variables

See `.env.example` for all required variables.

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript
- **Backend:** Node.js, Next.js API Routes
- **Database:** PostgreSQL
- **Auth:** GitHub OAuth via NextAuth.js
- **Deployment:** Docker

## License

MIT
