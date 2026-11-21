# BRUH-ENAT WOMEN'S TECH INNOVATION HACKATHON 2026
> **Tagline:** Empower. Protect. Transform.  
> **Theme:** Her Safety, Our Innovation: Building Safer Futures.  
> **Organizers:** ALX Ethiopia, UN Women, Enat Bank, and the Ministry of Innovation and Technology (MiNT).

---

## 🌟 Executive Overview

**BRUH-Enat** (ብሩህ እናት — *"Bright Mother"* or *"Guiding Light"*) is a premier two-day national innovation hackathon hosted at the **Capstone ALX Tech Hub in Lideta, Addis Ababa, Ethiopia**.

The hackathon is organised as part of the global **16 Days of Activism Against Gender-Based Violence campaign**, observed annually from November 25 to December 10, translating awareness and advocacy into practical action through technology and innovation.

The event convenes women software engineers, AI researchers, UI/UX designers, data scientists, legal practitioners, and gender equality advocates to architect survivor-centred digital solutions addressing gender-based violence (GBV) in Ethiopia.

---

## 📁 Project Architecture & File Hierarchy

```
biruh-enat-hackathon-2026/
├── index.html                   # Semantic HTML5 platform with Home landing page, theme toggle & centered 1st prize
├── verify.html                  # Branded email verification page with pass preview & resend form
├── ticket.html                  # Standalone printable/downloadable digital ticket pass page
├── assets/
│   └── og-banner.svg            # Branded Open Graph & Social sharing visual (1200x630, warm orange & charcoal)
├── css/
│   ├── variables.css            # Design tokens & Light/Dark theme palettes
│   ├── base.css                 # CSS reset, typography, buttons, accessibility skip-link & safety bar
│   ├── components.css           # Navigation, Hero, Cards, Schedule, Prizes, Rubrics, Accordion & Modals
│   └── responsive.css           # Responsive breakpoints (desktop, tablet, smartphone & print)
├── js/
│   ├── eventConfig.js           # Central Single Source of Truth for event details & API endpoint
│   ├── main.js                  # Theme toggle (persisted via localStorage), countdown, drawer, scrollspy
│   └── registration.js          # Live API integration for individual & 3–5 member team registrations
│
├── backend/                     # Node.js + Express + PostgreSQL Backend
│   ├── package.json             # Backend dependencies and execution scripts
│   ├── .env.example             # Environment template with PostgreSQL/Supabase and security parameters
│   ├── database/
│   │   ├── migrations/
│   │   │   └── 001_initial_schema.sql  # Normalized PostgreSQL schema (admins, registrations, attendees, teams...)
│   │   └── migrate.js           # Database migration runner script
│   ├── src/
│   │   ├── config/
│   │   │   ├── environment.js   # Environment variable loader and validator
│   │   │   └── database.js      # PostgreSQL connection pool & transaction manager
│   │   ├── controllers/
│   │   │   ├── healthController.js        # GET /api/health with real database connection status
│   │   │   └── registrationController.js  # POST /api/registrations/individual & team endpoints
│   │   ├── middleware/
│   │   │   ├── errorHandler.js   # Centralized error handler preventing sensitive leaks
│   │   │   ├── rateLimiter.js    # Rate limiting protection
│   │   │   └── requestValidator.js # JSON validation and content-type enforcement
│   │   ├── routes/
│   │   │   ├── healthRoutes.js
│   │   │   └── registrationRoutes.js
│   │   ├── services/
│   │   │   └── registrationService.js # Transactional registration persistence & duplicate prevention
│   │   ├── utils/
│   │   │   ├── logger.js         # Structured timestamped logger
│   │   │   └── responseHelper.js # Standardized JSON response formatting
│   │   ├── validators/
│   │   │   └── registrationValidator.js # Individual & Team (3–5 members) schema validators
│   │   ├── app.js               # Express application initialization & security middleware
│   │   └── server.js            # Server entry point & graceful shutdown
│   └── tests/
│       ├── health.test.js       # Diagnostic health check endpoint test
│       ├── registration.test.js # Comprehensive registration validation & API test suite
│       └── run-all.js           # Master test runner
│
└── README.md                    # Platform documentation and deployment guide
```

---

## 🚀 Key Functional Capabilities

1. **Interactive Schedule with Confirmed Dates:**
   - Tab switcher for Day 1 Innovation Sprint (Dec 5, 2026) and Day 2 Final Presentations & Awards (Dec 12, 2026 at ALX Ledeta Tech Hub).
2. **Instant Light / Dark Mode Toggle:**
   - Instant theme toggle in navbar, persisting preference via `localStorage` and respecting device `prefers-color-scheme`.
4. **Authoritative Registration Backend (PostgreSQL / Supabase):**
   - Individual and formed team (strictly 3 to 5 members) registration with transactional integrity.
   - Initial status: `PENDING_EMAIL_VERIFICATION`.
   - Authoritative unique reference codes (`BE-2026-IND-XXXX`, `BE-2026-TEAM-XXXX`).
   - Duplicate prevention on email addresses across all attendees.
   - Separate attendee database record for every individual and team member.
5. **No Fake Client-Side Persistence:**
   - Real backend submission. Incomplete or failed requests preserve form data for retry without fake-success modals or silent localStorage persistence.
6. **Strict Safety & Eligibility Enforcements:**
   - Mandatory affirmation: Women participants only.
   - Mandatory pledge: All prototypes must use synthetic or fictional data; zero collection of real survivor disclosures.
7. **Ethical Foundation & Guiding Principles:**
   - Survivor-Centred Approach, Privacy and Confidentiality, Do No Harm, Responsible AI, and Accessibility & Inclusion.
7. **Interactive Schedule with Confirmed Dates:**
   - Tab switcher for Day 1 Innovation Sprint (Dec 5, 2026) and Day 2 Final Presentations & Awards (Dec 12, 2026 at ALX Ledeta Tech Hub).
9. **Centered First Prize Visual Hierarchy:**
   - Desktop horizontal display with 1st Prize (250,000 ETB) centered and visually emphasized between 2nd Prize (150,000 ETB, left) and 3rd Prize (100,000 ETB, right).
10. **Live Health & Diagnostics Endpoint (`/api/health`):**
    - Accurately checks and reports real PostgreSQL connection status, uptime, server time, and environment.

---

## 🏆 Prizes Structure

- **1st Place (Center):** **250,000 ETB**
  - Direct entry into MiNT Ventures incubation track
  - Access to initial financing opportunities through Enat Bank
  - Executive mentorship with UN Women & Enat Bank leadership
  - Pilot deployment consultation with government stakeholders
- **2nd Place (Left):** **150,000 ETB**
- **3rd Place (Right):** **100,000 ETB**

---

## 🛠️ Backend Setup & Installation

### 1. Requirements
- Node.js (v18.x or v20.x recommended)
- PostgreSQL database (Supabase PostgreSQL recommended, or local PostgreSQL instance)

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment Variables
Copy the template configuration:
```bash
cp .env.example .env
```
Open `backend/.env` and configure your database connection:
```env
PORT=5000
NODE_ENV=development

# PostgreSQL / Supabase connection URL
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres
DATABASE_SSL=false
```

### 4. Run Schema Migrations
```bash
npm run migrate
```
The migration script creates the full normalized schema (`registrations`, `teams`, `attendees`, `tickets`, `event_sessions`, `attendance`, `email_logs`, `admin_audit_logs`, `google_sheets_sync`).

### 5. Start the Server
```bash
# Production / standard start:
npm start

# Development mode with automatic reload:
npm run dev
```
The server will start listening on `http://localhost:5000` and automatically serve both the static frontend and the `/api` endpoints.

### 6. Run Automated Tests
```bash
npm test
```
Runs the automated health and registration test suites covering:
- Health diagnostics schema and status reporting
- Individual registration validation (valid data, missing fields, email format, track selection)
- Team registration validation (3 members, 5 members, <3 rejection, >5 rejection, duplicate team emails, leader verification)
- HTTP API status code assertions (400 validation error, 415 unsupported media type, 404 unknown route)

---

## 🔌 API Endpoints Reference

### 1. System Health
- **`GET /api/health`**
  - Returns server uptime, environment, and real PostgreSQL connection state.
  - Returns `200 OK` when PostgreSQL is connected (`status: "healthy"`).
  - Returns `503 Service Unavailable` when database is unreachable (`status: "degraded"`).

### 2. Registrations
- **`POST /api/registrations/individual`**
  - Registers a solo applicant.
  - Validates full name, email, phone, discipline, preferred track, and safety pledge.
  - Creates a registration record and a single attendee record (`is_team_leader: 0`).
  - Sets initial status to `PENDING_EMAIL_VERIFICATION`.
  - Queues Google Sheets synchronization task.
  - Returns `201 Created` with generated reference code (`BE-2026-IND-XXXX`).
  - Returns `409 Conflict` if the email address is already registered.

- **`POST /api/registrations/team`**
  - Registers a formed team of 3 to 5 women innovators.
  - Validates team name, track, solution concept, team leader details, and each member's details.
  - Rejects submissions with fewer than 3 members or more than 5 members.
  - Rejects submissions with duplicate email addresses within the team.
  - Atomic database transaction: creates registration, team record, team leader attendee record, and individual attendee records for every member.
  - Sets initial status to `PENDING_EMAIL_VERIFICATION`.
  - Queues Google Sheets synchronization tasks for team and each attendee.
  - Returns `201 Created` with generated reference code (`BE-2026-TEAM-XXXX`).
  - Returns `409 Conflict` if any member's email address is already registered.

- **`POST /api/register`**
  - Unified endpoint compatible with the website's form submission engine.
  - Automatically routes to `registerIndividual` or `registerTeam` based on payload.

### 3. Email Verification & QR Ticketing (Round 2)
- **`GET /api/verify?token=...` & `POST /api/verify`**
  - Read-only pre-validation on `GET` (scanner safe) and explicit single-use burn on `POST`.
  - Checks expiration (48 hours) and ensures one-time use (`used_at`).
  - Atomically marks token as used, updates `attendees.email_verified = TRUE`.
  - Generates official QR ticket pass (`BE26-XXXX-XXXX`) and saves to `tickets` table.
  - Dispatches confirmation email with embedded high-resolution QR code pass.
  - Browser visits redirect seamlessly to `verify.html`.

- **`POST /api/verify/resend`**
  - Accepts `{ email }` to regenerate a fresh verification token and resend the verification email.
  - Returns `409 Conflict` if the email address is already verified.

- **`GET /api/tickets/:ticketCode`**
  - Public ticket endpoint returning attendee verification state, event date, venue, and QR code data URI. Sanitized against personal data exposure.

- **`POST /api/tickets/resend`**
  - Accepts `{ email }` to re-deliver official QR ticket email to verified attendees.

### 4. Admin Authentication & Dashboard (Round 3)
- **`POST /api/admin/login`**
  - Dedicated rate-limited endpoint (10 attempts per 15 mins) verifying credentials with salted bcrypt.
  - Sets HttpOnly, SameSite session cookie and issues expiring JWT.
- **`POST /api/admin/logout`**
  - Clears session cookie and logs audit trail.
- **`GET /api/admin/me`**
  - Returns sanitized administrator profile and role (`SUPER_ADMIN`, `ADMIN`, `CHECKIN_STAFF`).
- **`GET /api/admin/stats`**
  - Real database analytics: registrations, attendees, verification rate, check-in rate, and track participation.
- **`GET /api/admin/attendees` & `GET /api/admin/attendees/:id`**
  - Filterable, searchable, paginated participant directory with team rosters and ticket details.
- **`POST /api/admin/tickets/:ticketId/revoke`**
  - Revokes an attendee ticket; requires an audit reason.
- **`GET /api/admin/sessions` & `POST /api/admin/sessions/:id/activate`**
  - Multi-day event session management and active desk target switching.
- **`GET /api/admin/export/attendees` & `GET /api/admin/export/attendance`**
  - Excel-compatible UTF-8 BOM CSV data exports.

### 5. On-Site Check-In System (Round 3)
- **`POST /api/check-in/scan`**
  - High-throughput QR scan check-in. Validates ticket, status, and verification.
  - Atomic duplicate prevention via `UNIQUE(attendee_id, event_session_id)` returns `409 Conflict` on duplicate scan.
- **`POST /api/check-in/manual`**
  - On-site manual check-in with required reason for audit logging.
- **`GET /api/check-in/search`**
  - Rapid attendee lookup for desk staff.
- **`GET /api/check-in/recent`**
  - Live feed of recent desk check-ins.

### 6. Google Sheets API Integration (Round 4)
- **`GET /api/admin/google-sheets/status`**
  - Connection status, configured spreadsheet metadata, and outbox queue metrics.
- **`POST /api/admin/google-sheets/sync`**
  - Triggers processing of pending and retryable queue items.
- **`POST /api/admin/google-sheets/sync/bulk`**
  - Bulk synchronizes all existing PostgreSQL attendees and attendance records into Sheets.
- **`POST /api/admin/google-sheets/retry-failed`**
  - Resets failed queue records to `PENDING` and triggers processing.
- **`GET /api/admin/google-sheets/queue`**
  - Paginated view of the synchronization outbox queue.
- **`GET /api/admin/google-sheets/history`**
  - Audit history of bulk synchronization operations.
- **`GET /api/admin/google-sheets/spreadsheet`**
  - Returns safe spreadsheet link and worksheet names.

---

## 📈 Google Sheets API Integration Guide (Round 4)

The backend provides automatic, reliable, non-blocking synchronization from PostgreSQL into Google Sheets using the official Google Sheets API. PostgreSQL remains the single source of truth; any temporary Google API failure or quota limit never blocks core hackathon operations.

### Spreadsheet Structure (4 Worksheets)

The integration writes to four structured tabs in your Google Spreadsheet:

1. **`All Attendees`**: Consolidated master roster of all individual applicants and team members. Includes Attendee ID, Registration ID, Pathway, Team Name, Contact Info, Track, Role, Email Verification Status, Ticket Code, Ticket Status, Attendance Status, Last Check-in Time, and Last Sync Timestamp.
2. **`Individual Registrations`**: Individual applicant profiles and verification statuses.
3. **`Team Registrations`**: Complete team rosters (3 to 5 members per team), leader attribution, member roles, and contact information.
4. **`Attendance Records`**: Physical event check-ins across event sessions (Day 1, Day 2), recorded with timestamp, method (QR or Manual), and staff verifier.

### Step-by-Step Setup Instructions

#### Step 1: Create or Select a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with your Google account.
3. Click the project dropdown at the top of the page and click **New Project**.
4. Name your project (e.g., `bruh-enat-hackathon-2026`) and click **Create**.

#### Step 2: Enable the Google Sheets API
1. In your Google Cloud project, open the navigation menu and go to **APIs & Services > Library**.
2. Search for **Google Sheets API**.
3. Click on **Google Sheets API** and click the blue **Enable** button.

#### Step 3: Create a Service Account & Credentials
1. In the navigation menu, go to **APIs & Services > Credentials**.
2. Click **+ CREATE CREDENTIALS** at the top and select **Service account**.
3. Enter a Service account name (e.g., `sheets-sync-worker`).
4. Click **Create and Continue**, then click **Done**.
5. In the Service Accounts list, click on the newly created service account email.
6. Go to the **Keys** tab, click **ADD KEY > Create new key**, select **JSON**, and click **Create**.
7. A `.json` file containing your service account private key will be downloaded to your computer.

#### Step 4: Create the Google Spreadsheet
1. Go to [Google Sheets](https://sheets.google.com/) and create a new blank spreadsheet.
2. Title the spreadsheet: `BRUH-Enat Hackathon 2026 — Master Event Data`.
3. Rename the first sheet tab to `All Attendees`.
4. Add three additional tabs by clicking the `+` icon:
   - `Individual Registrations`
   - `Team Registrations`
   - `Attendance Records`
   *(Note: If you leave the spreadsheet with only default sheets, the backend will automatically create missing tabs and format their header rows during initial synchronization).*
5. Copy the **Spreadsheet ID** from the browser URL:
   `https://docs.google.com/spreadsheets/d/`**`[YOUR-SPREADSHEET-ID]`**`/edit`

#### Step 5: Share the Spreadsheet with the Service Account
1. Open the downloaded service account JSON file and copy the `client_email` address (e.g. `sheets-sync-worker@bruh-enat-hackathon-2026.iam.gserviceaccount.com`).
2. In your Google Spreadsheet, click the green **Share** button in the top-right corner.
3. Paste the service account email address into the share box.
4. Set the role to **Editor** and uncheck "Notify people" (service accounts do not have inboxes).
5. Click **Share**.

#### Step 6: Configure Environment Variables
Open `backend/.env` and update the Google Sheets configuration section:

**Option A (Direct Environment Variables — Recommended for Cloud / Render / Railway):**
```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=sheets-sync-worker@your-project.iam.gserviceaccount.com
# Paste the full private key from the JSON file including newlines or escaped \n
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADAN...-----END PRIVATE KEY-----\n"
```

**Option B (Service Account JSON Key File):**
```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_APPLICATION_CREDENTIALS=./config/google-service-account.json
```
*(Never commit `google-service-account.json` to version control! It is already added to `.gitignore`).*

#### Step 7: Run and Test Synchronization
Test your connection and run initial synchronization:
```bash
# Test connection and process pending queue:
npm run sync-sheets

# Bulk sync all existing database records into Google Sheets:
npm run sync-sheets -- --bulk
```

### Troubleshooting Guide

| Issue / Error | Cause | Resolution |
| :--- | :--- | :--- |
| **`Permission denied (403)`** | Spreadsheet not shared with service account | Click Share on your Google Sheet, add the service account email, and grant **Editor** role. |
| **`Spreadsheet not found (404)`** | Invalid `GOOGLE_SPREADSHEET_ID` | Check the spreadsheet URL and verify the ID between `/d/` and `/edit`. |
| **`invalid_grant`** | Malformed private key or clock skew | Ensure `GOOGLE_PRIVATE_KEY` has proper `\n` newlines, or use `GOOGLE_APPLICATION_CREDENTIALS` pointing to the JSON file. |
| **`API quota exceeded (429)`** | Google API rate limit reached | The queue automatically pauses and retries with exponential backoff (1m, 2m, 4m, 8m). |
| **`Google Sheets disabled`** | `GOOGLE_SHEETS_ENABLED=false` | Set `GOOGLE_SHEETS_ENABLED=true` in `backend/.env` and restart the backend. |
| **`Failed queue items`** | Temporary network interruption | Click **Retry Failed Records** in the Admin Dashboard (`/admin`) or run `npm run sync-sheets`. |

---

## 🔒 Security & Data Protection

- **No Sensitive Case Data:** In alignment with our Survivor Safety Pledge, no real survivor incident disclosures or case files are collected.
- **SQL Injection Prevention:** 100% parameterized queries using PostgreSQL placeholders (`$1, $2, ...`).
- **HTTP Security Headers:** Protected with `helmet` for secure response headers.
- **CORS Protection:** Configured to whitelist authorized origins.
- **Rate Limiting:** Protects API endpoints against brute force and automated submission spam.
- **No Secret Exposure:** Database credentials and keys remain strictly in backend environment variables and are never bundled in client-side scripts.
