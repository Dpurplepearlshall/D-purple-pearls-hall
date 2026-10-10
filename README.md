# D-purple pearls hall

Full-stack school whitelist portal built with React/Vite/TypeScript, an Express/Node TypeScript API, and PostgreSQL.

## Features

- Owner login uses the configured owner username; students sign in with their admission number and teachers with their teacher ID. Login uses JWT authentication and bcrypt password hashing.
- Students and teachers can register only when their admission number/teacher ID is active on the owner-managed whitelist; they provide a Gmail address and password, while their display name comes from the school record.
- Inactive or unlisted accounts cannot log in and receive a contact-owner message.
- Owner console to add, class-group, list, and deactivate students and teachers. Deactivating removes the login but preserves student records and past scores.
- Public school home page with announcements, owner-managed news posts, and vacation, results-release, and resumption dates.
- Students can be entered in Nigerian class order (Nursery 1-2, Primary 1-6, JSS 1-3, SS 1-3); classes advance once annually from September, and SS 3 advances to Graduated.
- Teachers and owners can upload term results for an active student, including the student's current class; the class is retained with every result and in the upload history.
- Students see each term average out of 100 and their rank among students with results in that term.
- Students and owners can print a term report card showing subjects, scores, letter grades, average, and ranking.
- Owners can select an admission number in the student list to inspect the student's scores and the complete term ranking.
- Owner activity page lists login and result-upload events with timestamps.
- Owner account support can reset the password for an active, registered student or teacher; the owner shares the temporary password securely.
- The owner can download student, teacher, result, and activity CSV files, plus a JSON data backup. Backups exclude passwords, password hashes, and tokens and should be stored securely.
- SQL migration and create-only environment-driven owner seed, so an owner-changed password persists across restarts; no credentials or secrets are committed.

## Local setup

Requirements: Node.js 20+, npm, and PostgreSQL 14+.

1. Create a database, for example `d_purple_pearls`.
2. Copy `backend/.env.example` to `backend/.env` and set:
   - `DATABASE_URL` to your PostgreSQL connection string.
   - `JWT_SECRET` to a long random value (never commit it).
   - `OWNER_USERNAME` (default `Umm Raaidah`) and `OWNER_PASSWORD` to the first owner login. The password must be 8+ characters.
   - `FRONTEND_URL` to `http://localhost:5173`.
3. Copy `frontend/.env.example` to `frontend/.env` (the default API URL is suitable locally).
4. From the repository root run:

   ```sh
   npm install
   npm run migrate --workspace backend
   npm run seed --workspace backend
   npm run dev
   ```

   The API runs on `http://localhost:4000`; the Vite UI runs on `http://localhost:5173`.

To validate without starting servers:

```sh
npm run typecheck
npm run build
npm test
```

## Using the portal

The public home page displays school announcements and calendar dates; sign in using the controls at its top right. Log in as the seeded owner, add active students with their class and teachers, then have each person register using their whitelisted ID and a password. Teachers upload results for active student admission numbers with current class, term, subjects, and scores. Students see term histories, averages, and rankings and can print a term report card. Owners can click an admission number in the class-grouped student register to inspect both active and inactive students' historical scores and class rankings, and print a term report card. Use the Account support page to reset an active registered student's or teacher's password, and Data & backups to download CSV exports or a JSON school-data backup. Keep downloaded exports and backups private; they do not contain login credentials.

## Environment variables

### Backend

`PORT` (default `4000`), `DATABASE_URL`, `JWT_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, and `FRONTEND_URL`.

### Frontend

`VITE_API_URL` (default `http://localhost:4000/api`).

## Render deployment

`render.yaml` defines a managed PostgreSQL database, API web service, and static frontend. In Render, create a Blueprint from this repository, then provide the three `sync: false` values (`JWT_SECRET`, `OWNER_EMAIL`, and `OWNER_PASSWORD`) when prompted. `preDeployCommand` applies the migration and seeds/updates the owner. If you change the generated Render service names or domains, update `FRONTEND_URL` and `VITE_API_URL` accordingly. Configure a custom domain in Render if desired.

The Render Blueprint is ready for global access, but deployment requires connecting this project to a GitHub repository and setting the three secret environment values in Render. After deployment, the static frontend and API will be reachable from any device with internet access. Configure email delivery separately before sending result notifications; storing Gmail addresses is now supported, but this project does not send email without an SMTP/provider credential.
