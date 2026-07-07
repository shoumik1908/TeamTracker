# Power Automate Webhook Implementation Guide

This guide details how to securely connect Microsoft Teams to your Team Tracker dashboard using Microsoft Power Automate. 

---

## 🛠️ Step 1: Your Webhook Configuration

- **API Endpoint URL:** `https://<YOUR_DEPLOYED_BACKEND_URL>/api/webhooks/power-automate`
  *(For local testing, you can use ngrok: e.g., `https://<random-id>.ngrok-free.app/api/webhooks/power-automate`)*
- **HTTP Method:** `POST`
- **Secret Header Key:** `x-webhook-secret`
- **Secret Header Value:** `277c988d142dbd722ebcba15d07dda36d9154cdefdb9365cde3557d663d034d1`

---

## ⚡ Step 2: Build the Flow in Power Automate

1. Go to [make.powerautomate.com](https://make.powerautomate.com) and log in with your Microsoft 365 account.
2. Click **Create** → Select **Automated cloud flow**.
3. Name your flow (e.g., `Sync Teams Meeting - TESTING Project`).
4. Choose the starting trigger: **"When a Teams meeting ends"** (or **"When a new file is created"** if grabbing recordings from OneDrive/SharePoint).
5. Add an **HTTP** Action to your flow:
   - **Method:** `POST`
   - **URI:** `https://<YOUR_DEPLOYED_BACKEND_URL>/api/webhooks/power-automate`
   - **Headers:**
     - `Content-Type`: `application/json`
     - `x-webhook-secret`: `277c988d142dbd722ebcba15d07dda36d9154cdefdb9365cde3557d663d034d1`
   - **Body:** Copy and paste the template below. Replace the `projectId` value with the database ID of your target project (e.g., `cmra9a5um00009x858kjsekg9` for the **TESTING** project).

### JSON Body Template
Use Power Automate's Dynamic Content to populate the fields inside `@{...}`:
```json
{
  "projectId": "cmra9a5um00009x858kjsekg9",
  "teamsMeetingId": "@{triggerOutputs()?['body/id']}",
  "subject": "@{triggerOutputs()?['body/subject']}",
  "organizer": "@{triggerOutputs()?['body/organizer']}",
  "startTime": "@{triggerOutputs()?['body/startTime']}",
  "endTime": "@{triggerOutputs()?['body/endTime']}",
  "recordingUrl": "@{triggerOutputs()?['body/recordingUrl']}",
  "transcriptText": "@{triggerOutputs()?['body/transcriptText']}"
}
```

6. Click **Save** and test the flow by running a mock meeting in that channel!

---

## 🔒 Security & Troubleshooting

- **401 Unauthorized:** If your webhook returns 401, verify that you added the `x-webhook-secret` header in the HTTP action and that it matches the value in your backend `.env` file exactly.
- **409 Conflict:** Power Automate might retry requests if it times out. The backend handles this gracefully: if a meeting with the same `teamsMeetingId` already exists in the database, it will return `409 Conflict` and ignore the request to prevent duplicate meetings.
- **Local Testing:** Power Automate cannot reach `http://localhost:3001` directly. To test before deploying, run a local tunnel command:
  ```bash
  npx localtunnel --port 3001
  ```
  Copy the generated `https://...` address, append `/api/webhooks/power-automate`, and paste it into Power Automate.
