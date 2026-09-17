# D-purple pearls hall

Full-stack school whitelist portal built with React/Vite/TypeScript, an Express/Node TypeScript API, and PostgreSQL.

## Features

- Owner login uses the configured owner username; students and teachers use their registered Gmail address with JWT authentication and bcrypt password hashing.
- Students and teachers can register only when their admission number/teacher ID is active on the owner-managed whitelist; they provide a Gmail address and password, while their display name comes from the school record.
- Inactive or unlisted accounts cannot log in and receive a contact-owner message.
- Owner console to add, list, and delete (soft-disable) students and teachers. Deleting also removes the related login.
- Teachers and owners can upload a result for an active student; each upload is recorded in the owner activity log.
- Owner activity page lists login and result-upload events with timestamps.
- SQL migration and environment-driven owner seed; no credentials or secrets are committed.

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

Log in as the seeded owner, add active students and teachers, then have each person register from the login screen using their whitelisted ID and a password. Teachers can upload results for active student admission numbers. Owner activity shows sign-ins and uploads.

## Environment variables

### Backend

`PORT` (default `4000`), `DATABASE_URL`, `JWT_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, and `FRONTEND_URL`.

### Frontend

`VITE_API_URL` (default `http://localhost:4000/api`).

## Render deployment

`render.yaml` defines a managed PostgreSQL database, API web service, and static frontend. In Render, create a Blueprint from this repository, then provide the three `sync: false` values (`JWT_SECRET`, `OWNER_EMAIL`, and `OWNER_PASSWORD`) when prompted. `preDeployCommand` applies the migration and seeds/updates the owner. If you change the generated Render service names or domains, update `FRONTEND_URL` and `VITE_API_URL` accordingly. Configure a custom domain in Render if desired.

The Render Blueprint is ready for global access, but deployment requires connecting this project to a GitHub repository and setting the three secret environment values in Render. After deployment, the static frontend and API will be reachable from any device with internet access. Configure email delivery separately before sending result notifications; storing Gmail addresses is now supported, but this project does not send email without an SMTP/provider credential.
