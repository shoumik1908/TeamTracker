# Team members admin page

A table for admins to manage team members: set/edit their email (so they can
self-register), see whether they've created an account yet, and assign roles
to accounts that exist. Also supports adding brand-new team members.

## What's in this bundle

```
src/types/admin.ts                        Shared TS types
src/api/teamMembersApi.ts                  Axios calls to your backend
src/api/teamMembersQueries.ts              React Query hooks wrapping the API
src/pages/admin/TeamMembersAdminPage.tsx   The table page
src/pages/admin/AddTeamMemberDialog.tsx    "Add team member" form dialog
```

## Before you copy these in

**1. shadcn/ui components used** — install any you don't already have:

```bash
npx shadcn add button input label dialog select table badge
```

I did NOT include stub versions of these in this bundle (they were only used
locally to type-check against realistic prop shapes) — use your project's
real generated ones.

**2. Toast library** — this uses `sonner` for success/error toasts:

```bash
npm install sonner
```

Make sure `<Toaster />` from sonner is mounted once near the root of your app
(usually in `App.tsx` or `main.tsx`) if it isn't already:

```tsx
import { Toaster } from "sonner";
// ...
<Toaster />
```

**3. Axios instance** — `teamMembersApi.ts` creates its own axios instance
reading `VITE_API_BASE_URL` and a token from `localStorage`. If you already
have a shared axios instance (e.g. `src/lib/api.ts`) with auth handling built
in, replace the top of that file with an import from there instead — don't
run two separate instances.

**4. Backend endpoints this expects** — some of these don't exist in the
backend yet and need to be added (see the "Backend endpoints needed" section
below):

```
GET   /api/team-members              list, each with { id, name, email,
                                      designation, joiningDate, user }
POST  /api/team-members               create a new team member
PATCH /api/team-members/:id           update email (or other fields)
GET   /api/roles                      list all roles { id, name }
PATCH /api/users/:id/role             already built earlier
```

## Mounting the route

Wherever your router is configured (`App.tsx` or a routes file):

```tsx
import TeamMembersAdminPage from "@/pages/admin/TeamMembersAdminPage";

<Route path="/admin/team-members" element={<TeamMembersAdminPage />} />
```

Wrap this route with whatever route-guarding you use for admin-only pages —
this page itself doesn't check permissions, it relies on the backend
rejecting unauthorized requests (401/403), so also add a client-side guard
if you have one, to avoid a flash of admin UI before the API calls fail.

## How it behaves

- **Email cell**: click to edit inline, Enter to save, Escape to cancel.
  Saves via `PATCH /team-members/:id`.
- **Account column**: shows "Not registered" if no `User` is linked yet,
  or Active/Deactivated based on the linked account's status.
- **Role column**: only shown for team members who've already registered —
  there's no role to assign until a `User` exists. Changing it calls the
  existing `PATCH /users/:id/role` endpoint.
- **Add team member**: opens a dialog for name (required), joining date
  (required), designation and email (optional). Matches your Prisma
  `TeamMember` model's required fields.

## Backend endpoints needed

Two of the endpoints above don't exist in what we've built so far:

- `GET /api/team-members` — needs to include the linked `user.role` via
  Prisma's `include`, e.g. `include: { user: { include: { role: true } } }`
- `POST /api/team-members` — plain create, validate with zod
- `PATCH /api/team-members/:id` — for the inline email edit (this can be
  the same handler as the bulk-email endpoint we discussed, just called
  with a single row, or a separate simple single-row PATCH — your call)
- `GET /api/roles` — simple `prisma.role.findMany()`, gated by
  `requirePermission("users:read")` or similar

Let me know if you want me to write these now, or hand them to Antigravity
alongside the rest.
