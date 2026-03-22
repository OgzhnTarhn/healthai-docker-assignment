# HEALTH AI Docker Assignment

Minimal full-stack Docker assignment for **SENG 384** using **React + Express.js + PostgreSQL + Docker Compose**.

## What is included?
- React frontend
- Express.js backend
- PostgreSQL database
- Seed users and posts
- Registration, mocked email verification, login
- Post creation, draft/publish/edit/status update
- Search and filtering
- Meeting request workflow with NDA checkbox
- Admin panel (users, posts, logs, CSV export)
- Profile edit, data export, notifications
- Single-command startup with Docker Compose

## Demo credentials
After the first startup, these seed users are created automatically:

- **Admin** → `admin@health.edu` / `123456`
- **Engineer** → `engineer@cankaya.edu.tr` / `123456`
- **Healthcare Professional** → `doctor@hacettepe.edu.tr` / `123456`

## Run with Docker
From the project root:

```bash
docker compose up --build
```

Open:
- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:5000/api/health`

Stop:

```bash
docker compose down
```

Remove DB volume too:

```bash
docker compose down -v
```

## Project structure
```text
healthai-docker-assignment/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── src/
├── frontend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   ├── vite.config.js
│   └── src/
├── screenshots/
├── docker-compose.yml
└── README.md
```

## What to screenshot for submission
Put your screenshots into the `screenshots/` folder before pushing.

Recommended screenshots:
1. Docker containers running (`docker compose ps` or Docker Desktop)
2. Registration with invalid non-.edu email showing error
3. Dashboard after successful login
4. New post saved as Draft
5. Same post after Publish (`Active` status)
6. Filtered search results
7. Meeting request flow
8. Admin panel with logs/users/posts
9. Profile/data export screen

## Notes
- Email verification is **mocked** for demo purposes.
- Authentication uses JWT.
- This project is intentionally small and demo-focused so it can be explained easily in a short submission/demo.

## Push to GitHub
```bash
git init
git add .
git commit -m "Initial Docker assignment submission"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```
