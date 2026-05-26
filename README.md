# DeskFlow - Support Ticket Triage Board

DeskFlow is a full-stack web application designed for support teams to triage, manage, and track customer support tickets efficiently. It strictly enforces state transition rules and Service Level Agreement (SLA) targets based on ticket priority.

## 🚀 Live Demos
- **Frontend (Deployed on Netlify)**: [Live Site](https://deskflow-triage-shubham.netlify.app/)
- **Backend API (Deployed on Render)**: [https://deskflow-triage-app-1.onrender.com](https://deskflow-triage-app-1.onrender.com)

## 🛠️ Tech Stack
- **Frontend**: React, Vite, Lucide Icons, Vanilla CSS (Glassmorphism & Modern UI)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (Atlas)
- **Deployment**: Netlify (Frontend) & Render (Backend)

## ✨ Core Features
- **Kanban-style Board View**: Visually manage tickets across four distinct states (`Open`, `In Progress`, `Resolved`, `Closed`).
- **Strict State Transitions**: Tickets can only be moved to adjacent states (e.g., `Open` ↔ `In Progress`), preventing invalid skips directly to `Resolved`.
- **Dynamic SLA Tracking**: 
  - `Urgent`: 1 hour target
  - `High`: 4 hours target
  - `Medium`: 24 hours target
  - `Low`: 72 hours target
- **SLA Breach Alerts**: Automatically flags tickets that exceed their SLA targets while unresolved.
- **Accurate Age Calculation**: Ticket age automatically freezes upon resolution.
- **Robust Error Handling**: Clear HTTP 400 responses for invalid inputs, missing fields, or invalid transitions instead of generic server crashes.

## ⚙️ Architecture & Deployment Setup
The project is built as a separated monolith where the frontend and backend live in the same repository but are deployed completely independently.

1. **Frontend**: Hosted on Netlify as a static site. The frontend is built from the `frontend/` directory. It defaults to the Render API URL but allows testers to configure a custom backend URL dynamically from the UI settings.
2. **Backend**: Hosted on Render as a Web Service. Render utilizes the `render.yaml` Blueprint to automatically configure the Node.js environment, install dependencies from `backend/`, and run `server.js`.
3. **Database**: Hosted securely on MongoDB Atlas, communicating seamlessly with the Render backend via IP whitelisting (`0.0.0.0/0`).

## 💻 Running Locally

### Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas URL)

### 1. Start the Backend
```bash
# Install dependencies
npm install --prefix backend

# Create a .env file inside backend/ and add your MONGODB_URI
# Example: MONGODB_URI=mongodb://localhost:27017/deskflow

# Start the server (runs on port 5000)
npm start
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will start on `http://localhost:5173`. You can click the "Settings" gear icon in the app header to ensure it points to `http://localhost:5000` for local development.

---
*Built with ❤️ for the DeskFlow Triage Challenge.*