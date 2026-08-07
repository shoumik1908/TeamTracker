# TeamTracker test cases

## Automated unit tests

Run the backend suite with `cd backend && npm test`.

| Area | Cases |
| --- | --- |
| Certificate upload | OCR credential persists; manual credential is trimmed; blank/missing credential clears the value; invalid OCR values are ignored. |
| Certificate verification | Uploaded certificate plus credential ID is verified; either missing value is unverified. |
| Edit requests | Notification/request linkage; ordinary notifications remain unchanged; approved changes update valid/expired status; rejected requests make no assignment change. |
| Certificate matching | Exact catalog match; tier mismatch is not auto-selected; ambiguous candidate requires manual selection. |
| Member matching | Exact recipient match; partial-name match; unrelated name is rejected; transcript name correction. |

## API integration cases

Run each case against an isolated PostgreSQL database with Azure/AI clients stubbed. Every endpoint must also be exercised without a token, with a member token, and with an admin token where applicable.

| Domain | Required cases |
| --- | --- |
| Auth | Register valid/duplicate user; login success/invalid password/inactive user; change password validation; `/me` token validation and expiry. |
| Admin | List roles/users; role update; activate/deactivate user; reset password; reject every action without `manageTeam`. |
| Members | List/search/paginate; create/update/delete; duplicate email; image/CV type and size validation; profile with projects/certifications; resume profile access. |
| Certifications | Catalog CRUD; assignment create/update/delete; duplicate assignment; member-only ownership enforcement; completion/expiry status derivation; filters and pagination. |
| Certificate upload | Analyze supported/unsupported documents; OCR data extraction; universal upload creates/updates assignment; duplicate file guard; replacement deletes old blob; delete clears file and credential; storage failure rollback/error response. |
| Certificate edit requests | Create request; admin notification is visible only to admins; list pending/all; approve applies dates and credential ID; reject leaves assignment unchanged; repeat decision returns 400; non-admin review returns 403. |
| Projects | CRUD; manager/member assignment; role update/removal; enrolment; pulse/blocker status; invalid project/member IDs. |
| Project updates | Create/list/update/delete; authorization; project/member validation. |
| Documentation and files | List/upload/delete project or pre-sales files; links and notes CRUD; SAS/download URL; file ownership and storage failures. |
| Notifications | Member/admin targeting; unread filtering/count; mark one/all read; deletion authorization; certificate edit-request actions appear only while pending. |
| Dashboard, search, reports | KPI calculations; status/progress datasets; deadline categories; global search escaping; report JSON/CSV/Excel/PDF headers and content. |
| Tasks and feedback | CRUD; assignee access; status/priority transitions; feedback with attachments; invalid/unauthorized task IDs. |
| Pre-sales | Opportunity CRUD; stage/progress transitions; member management; reset/convert; document analysis; proposal/section generation; document cleanup. |
| GTM | Plan CRUD; stage changes/audit log; partners, requirements, campaigns and collateral CRUD; upload/download URL validation. |
| Meetings and Teams | Sync/list meetings; summary; meeting-record upload, transcript edit/reanalysis, action-item status and deletion; retry job idempotence. |
| Resume and chat | Generate standard/tailored resumes; invalid job-description uploads; provider fallback/error behaviour; chat auth and malformed prompt handling. |
| Logs | Pagination, filters, masking of sensitive fields, admin-only access. |

## Frontend workflow cases

Run these in a browser test runner against mocked API responses, then once against a staging API.

| Screen | Required cases |
| --- | --- |
| Login and protected routes | Valid/invalid login, token expiry logout, redirect preservation, role-based navigation. |
| Dashboard | Admin and member dashboards, loading/error/empty states, KPI and chart navigation. |
| Members/profile | Create/edit/delete member, image/CV upload errors, certification/project accordions, responsive layout. |
| Certification tracker | Filter/search/expand rows; upload with OCR credential; manual credential fallback; verified/unverified tag; duplicate guard; delete file; edit-request submission. |
| Notifications | Unread/read state, delete action, admin View edit request, Accept applies changes, Reject discards changes, buttons disappear after review. |
| Projects, updates, files | CRUD dialogs, validation, upload/download links, optimistic/query refresh behaviour. |
| Tasks | Create/edit/delete, assignment, feedback attachment, status and permission state. |
| Pre-sales and GTM | Stage timeline, progress updates, collaborators, generated docs, partner/campaign/collateral workflows. |
| Reports, logs, deadlines | Filters, exports, empty/error states, date-boundary display. |
| CV generation and meetings | Upload, AI loading/failure states, generated document download, transcript/action-item edits. |

## Cross-cutting and release cases

- Verify every mutating API returns a validation error rather than a 500 for malformed JSON, missing IDs, oversized uploads, and unsupported file types.
- Verify all roles cannot access another member's records or admin-only endpoints.
- Test network timeout, Azure Blob outage, PostgreSQL outage, OCR/AI provider outage, and retry/idempotency paths.
- Test Chrome, Safari, and Firefox at desktop and mobile widths; keyboard-only navigation; focus order; labels; contrast; screen-reader names.
- Run production builds, `backend npm test`, migration deploy against staging, smoke test `/health`, and upload/report/download flows before release.
