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
| Password reset links | Token verifies against the hash it was minted from; stops verifying once the password changes (single use); does not verify against another user's hash; a tampered token is rejected; garbage input does not throw. |
| Blob naming and signing | Two uploads of one filename never share a key; the original filename stays recognisable; a caller prefix is kept; signing refuses an unknown container, a path containing `..`, an absolute path and backslash separators, while allowing a literal `..` inside a filename. |
| LinkedIn URLs | A bare host gains https; http is upgraded; a subdomain is accepted; blank clears the field; an omitted field leaves it untouched; `javascript:`, a lookalike host and an over-length value are rejected. |
| Meeting continuity | Model-returned ids are intersected with the ids the model was shown, so another project's id and a hallucinated id are both dropped; only items marked completed are collected; malformed model output yields nothing; action-item status is validated against the allowed set. |
| Pagination and sorting | Absent paging uses the defaults; a non-numeric, negative, zero or fractional page is a 400; an oversized limit is capped; an unknown sort field is a 400; sort order defaults to ascending. |
| CSV export safety | Values leading with `=`, `+`, `-`, `@` or a tab are neutralised so a spreadsheet does not execute them; ordinary values are unchanged. |
| Chat message rendering | Script tags and image-onerror payloads are escaped rather than rendered; bold, italic, bullets and line breaks still render; ampersands are not double-escaped. |
| Name correction | A misspelled full name is corrected; an ordinary two-word phrase, short words and stopwords are left alone; an unrelated transcript is returned byte-identical; a large transcript completes within a time bound. |

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
| Projects | CRUD; manager/member assignment; role update/removal; enrolment; pulse/blocker status; invalid project/member IDs; a blocker status outside open/resolved is a 400 and a blocker cannot be updated through another project's URL. |
| Project updates | Create/list/update/delete; authorization; project/member validation. |
| Documentation and files | List/upload/delete project or pre-sales files; links and notes CRUD; SAS/download URL; file ownership and storage failures. |
| Notifications | Member/admin targeting; unread filtering/count; mark one/all read; deletion authorization; certificate edit-request actions appear only while pending; one admin marking a role-targeted notification read leaves it unread for every other admin, and notifications already marked read before the per-recipient change stay read. |
| Dashboard, search, reports | KPI calculations; status/progress datasets; deadline categories; global search escaping; report JSON/CSV/Excel/PDF headers and content. |
| Tasks and feedback | CRUD; assignee access; status/priority transitions; feedback with attachments; invalid/unauthorized task IDs. |
| Pre-sales | Opportunity CRUD; stage/progress transitions; member management; reset/convert; document analysis; proposal/section generation; document cleanup; a non-assigned member gets 403 rather than 500; converting twice is a 409 and creates exactly one project, with migrated rows detached from the opportunity. |
| GTM | Plan CRUD; stage changes/audit log; partners, requirements, campaigns and collateral CRUD; upload/download URL validation; a partner update with an unparseable renewalDate or an unknown id is rejected before any requirement is deleted; the partner audit counts distinct members, not certification rows. |
| Meetings and Teams | Sync/list meetings; summary; meeting-record upload, transcript edit/reanalysis, action-item status and deletion; retry job idempotence. |
| Resume and chat | Generate standard/tailored resumes; invalid job-description uploads; provider fallback/error behaviour; chat auth and malformed prompt handling. |
| Logs | Pagination, filters, masking of sensitive fields, admin-only access; a negative page is a 400 and the limit is capped. |
| Meeting reports | `/meeting-report` rejects an anonymous caller and a signed-in non-member of the project; a project member and an admin succeed; an unparseable date, an inverted range and missing params are each a 400. |
| Meeting records | Re-analysis that fails part-way leaves the existing attendees, decisions and action items intact; a create that cannot be persisted leaves no partial record; `createdBy` records the uploader so the uploader can delete their own record; a non-member's delete is refused and the record survives. |
| Member self-service | A member may edit their own contact details but not `allocationPercentage`, `status`, `designation` or `joiningDate`; an admin may change all of them. |
| Member accounts | Creating a member with an email returns a single-use reset link rather than a generated password; the old `firstname+xebia` form no longer authenticates; the link works once and is refused on replay; a member without an email gets no account. |
| Environment-gated endpoints | The mock Teams sync refuses to write demonstration rows when `NODE_ENV=production`. |
| Seed and first-run setup | `npm run seed` creates a bootstrap admin who can sign in and is forced to change the password; running it twice leaves one admin and does not duplicate notifications. |
| Schema constraints | A member cannot be assigned to the same opportunity twice; deleting a user who created a learning project, CoE ticket or session is refused rather than cascading; a stage-change log cannot reference an opportunity that does not exist. |
| Upload rejections | A file rejected by a type filter returns 400 with the reason, not 500. |
| Error responses | A failed lookup in a production process returns a generic message rather than Prisma internals; CORS does not trust a localhost origin in production. |

## Frontend workflow cases

Run these in a browser test runner against mocked API responses, then once against a staging API.

| Screen | Required cases |
| --- | --- |
| Login and protected routes | Valid/invalid login, token expiry logout, redirect preservation, role-based navigation; a forced password change redirects and cannot be skipped; `/reset-password` opens without a session. |
| Sign-out and handover | Signing out discards the cached admin user list, current user and notifications, so the next person to sign in on the same machine sees none of the previous user's data; a corrupted stored session recovers to the login page instead of hanging on the loading spinner. |
| API error surfaces | A gateway HTML error page is reported as a server-unavailable message rather than a JSON parse error; a JSON error body still shows the server's own message. |
| Dashboard | Admin and member dashboards, loading/error/empty states, KPI and chart navigation; "Tasks due this week" counts every open task actually due in the next seven days and reports a real overdue figure; a render error shows a recovery message, never a stack trace. |
| Members/profile | Create/edit/delete member, image/CV upload errors, certification/project accordions, responsive layout; saved skills replace the CV-extracted list immediately; cancelling the CV file picker leaves no stuck spinner. |
| Certification tracker | Filter/search/expand rows; upload with OCR credential; manual credential fallback; verified/unverified tag; duplicate guard; delete file; edit-request submission; a certification with no expiry date can still be uploaded; typing in search issues one query, not one per keystroke. |
| Notifications | Unread/read state, delete action, admin View edit request, Accept applies changes, Reject discards changes, buttons disappear after review. |
| Projects, updates, files | CRUD dialogs, validation, upload/download links, optimistic/query refresh behaviour; files, links and notes are attributed to the signed-in user, and their author can delete their own note. |
| Tasks | Create/edit/delete, assignment, feedback attachment, status and permission state; the task pages read the signed-in user from the auth context rather than fetching a second copy. |
| Pre-sales and GTM | Stage timeline, progress updates, collaborators, generated docs, partner/campaign/collateral workflows; a proposal section that already has AI-generated text can be edited in place; a progress update only reports success once the write lands. |
| Reports, logs, deadlines | Filters, exports, empty/error states, date-boundary display; the log feed recovers after a transient failure, search is debounced, and infinite scroll does not duplicate a page; meeting report windows use local calendar dates, not UTC. |
| CV generation and meetings | Upload, AI loading/failure states, generated document download, transcript/action-item edits. |

## Cross-cutting and release cases

- Verify every mutating API returns a validation error rather than a 500 for malformed JSON, missing IDs, oversized uploads, and unsupported file types.
- Verify all roles cannot access another member's records or admin-only endpoints.
- Test network timeout, Azure Blob outage, PostgreSQL outage, OCR/AI provider outage, and retry/idempotency paths.
- Test Chrome, Safari, and Firefox at desktop and mobile widths; keyboard-only navigation; focus order; labels; contrast; screen-reader names.
- Keyboard-only checks with coverage today: the members table sorts via its column headers and announces the sort through `aria-sort`; a member row opens with Enter; CoE dialogs expose `role="dialog"`, take focus on open, close on Escape and return focus to the control that opened them.
- Run production builds, `backend npm test`, migration deploy against staging, smoke test `/health`, and upload/report/download flows before release.
