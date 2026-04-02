# Health AI - Docker Assignment (SENG 384)

**Student Name Oğuzhan Tarhan
**Student ID: 202228045
**Course:** SENG 384  

## Project Overview
This project is a full-stack Dockerized platform tailored for the healthcare and engineering domains. It seamlessly connects healthcare professionals looking for technical solutions with engineers providing the required expertise. 

## Tech Stack
- **Frontend:** React (Vite), Glassmorphism UI
- **Backend:** Node.js, Express
- **Database:** PostgreSQL (pg)
- **Deployment:** Docker & Docker Compose

## Core Implemented Features
1. **Auth & Access Control:**
   - Registration with strictly validated institutional emails (`.edu` or `.edu.tr`).
   - JWT-based authentication and protected routes.
   - Role-based capabilities (Engineer / Healthcare / Admin).
2. **Post Lifecycle Management:**
   - Full CRUD for matching posts.
   - Dynamic Post Statuses: `draft`, `active`, `meeting_scheduled`, `partner_found`, `expired`.
3. **Advanced Filtering & Sorting:**
   - Real-time querying by Domain, City, Status, and Required Expertise.
   - "Newest/Oldest" sorting mechanism.
4. **Meeting & NDA Workflow:**
   - Users can securely express interest and accept NDA agreements before proposing time slots.
   - Post owners can instantly accept or decline incoming meeting requests.
   - Acceptances dynamically change post statuses.
5. **Admin Panel:**
   - Full user & post overview panel restricted to `admin` roles.
   - Moderation tools (Remove Posts).
   - System Activity Logging with granular date/action filtering.
   - 1-click **CSV Data Export**.
6. **Profile & GDPR Data Controls:**
   - On-demand JSON profile data export to comply with privacy requirements.
   - Contextual real-time Notification timeline.

## Demo Accounts
Pre-seeded for immediate grading and screenshot capturing:
- **Admin:** `admin@health.edu` (Pass: `123456`)
- **Doctor:** `doctor@hacettepe.edu.tr` (Pass: `123456`)
- **Engineer:** `engineer@cankaya.edu.tr` (Pass: `123456`)

## Prerequisites
- Docker & Docker Compose installed.

## How to Run
```bash
docker compose up --build -d
```

### Application URLs
- **Frontend:** [http://localhost:5174](http://localhost:5174)
- **Backend API:** [http://localhost:5000](http://localhost:5000)

## How to Stop
```bash
docker compose down
```

## Project Structure
```text
healthai-docker-assignment/
├── backend/
│   ├── src/
│   │   ├── db.js             # Database seeding and initialization
│   │   ├── index.js          # Main Express server and error boundary
│   │   ├── routes/           # Modularized endpoints (auth, posts, etc.)
│   │   └── middleware/       # JWT Auth and Role guarding
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── views/            # Isolated React pages (Dashboard, Admin, etc.)
│   │   ├── utils/api.js      # Centralized HTTP request interceptor
│   │   ├── App.jsx           # Routing and Theme orchestration
│   │   └── styles.css        # Premium Glassmorphism UI tokens
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml        # Docker orchestrator
```

## Required Screenshots for Submission
*Ensure these images are captured and pushed to your repo.*

- [ ] `01-docker-running.png` (Show `docker ps` terminal or Docker Desktop)
- [ ] `02-invalid-edu-registration.png` (Try registering with `@gmail` and screenshot the toast error)
- [ ] `03-dashboard-after-login.png` (Main screen post-login)
- [ ] `04-new-post-form.png` (Inside "My Posts" tab)
- [ ] `05-post-draft.png` (Screenshot a post labelled 'draft')
- [ ] `06-post-active.png` (Publish a post to 'active')
- [ ] `07-post-edited.png` (Show the form with populated data or a success toast)
- [ ] `08-filtered-results.png` (Apply a Domain and Status filter simultaneously)
- [ ] `09-meeting-request-nda.png` (Click heavily on a confidential post from another user)
- [ ] `10-meeting-scheduled-status.png` (Accept a meeting and screenshot the badge)
- [ ] `11-admin-users.png` (Login to Admin account and screenshot user list)
- [ ] `12-admin-posts.png` (Screenshot admin posts moderation)
- [ ] `13-admin-logs-csv.png` (Download CSV and screenshot logs view)
- [ ] `14-profile-edit.png` (Profile Settings Tab)
- [ ] `15-delete-account-warning.png` (GDPR Danger Zone view)
- [ ] `16-notifications.png` (Open notifications pane)

## Known Limitations
- Email verification natively mocks successful verifications without using a live SMTP transaction (per assignment allowance).
- "Delete Account" fires a visual component warning but does not irreversibly drop internal cascade relational chains to maintain evaluation data.
- The UI is strongly reliant on modern browsers capable of running backdrop-filter CSS.

## GitHub Submission
1. Add changes: `git add .`
2. Commit: `git commit -m "feat: complete SENG 384 MVP"`
3. Push: `git push origin main`
