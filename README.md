# Mini Drive — Private Multi-User Edition

A JavaScript full-stack file drive with separate `frontend/` and `backend/` folders. Includes account registration, password login, per-user private file lists, resumable chunk uploads, SHA-256 validation, duplicate detection within each user's drive, and streamed server-side downloads.

## Features
- Register a new account with name, email and password.
- Passwords are hashed with bcrypt; JWTs protect the API.
- Every user sees and downloads only files associated with their own account.
- "All your documents" lists uploaded files and offers download actions.
- Files are split into 5 MiB chunks and can resume after an interrupted upload.
- MongoDB Atlas stores users, upload sessions and file metadata only.
- File bytes and temporary chunks are stored on the backend machine's `backend/storage/` directory, not in MongoDB.

## Configure MongoDB Atlas
1. Visit https://cloud.mongodb.com/ and create/select a project and cluster.
2. Under **Database Access**, create a database user.
3. Under **Network Access**, add your current IP address.
4. Choose **Connect → Drivers → Node.js** and copy the connection string.
5. Copy `backend/.env.example` to `backend/.env`. Set `MONGO_URI` to your Atlas connection string. URL-encode special characters in the database user's password.
6. Set `JWT_SECRET` to a long random secret (at least 32 characters). Never commit `backend/.env`.

## Run backend (PowerShell)
From the project root:

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env and set MONGO_URI and JWT_SECRET
npm install
npm run dev
```

Wait for `Connected to MongoDB Atlas` and `Mini Drive API: http://localhost:5000`.

## Run frontend
Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually http://localhost:5173. Create an account, then upload files. Use a different email to test that accounts have separate document lists.

## API
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/upload/init` (authenticated)
- `POST /api/upload/chunk` (authenticated)
- `GET /api/files` (authenticated; only current user's files)
- `GET /api/files/:id/download` (authenticated; only current user's files)
- `GET /api/health`

## Security and deployment notes
This is an educational local demo. Before public deployment, add rate limiting, email verification, password reset, account/session revocation, CSRF/security headers, stronger abuse controls, and production logging. Download links use a JWT in the query string so native browser downloads can stream; for production, use secure HTTP-only cookies or short-lived signed download URLs. File bytes live on local disk, so a deployed multi-instance service should use shared object storage. Keep the Atlas URI and JWT secret out of GitHub.
