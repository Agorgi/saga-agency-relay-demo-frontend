# PR-J: Runtime Toggle

## Scope

Add a DB-backed runtime toggle for autonomous web chat replies, keep
`WEB_CHAT_AUTONOMOUS_RESPONSES_ENABLED` as a hard env ceiling, wire
`/api/web-chat` to the effective state, and expose the toggle plus audit log in
the existing admin web chat sessions page.

## Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260514195811_add_web_chat_runtime_settings/migration.sql`
- `src/lib/webChatRuntimeSettings.ts`
- `src/app/api/web-chat/route.ts`
- `src/app/(admin)/admin/(dashboard)/web-chat-sessions/actions.ts`
- `src/app/(admin)/admin/(dashboard)/web-chat-sessions/page.tsx`

## Migration

- Filename: `20260514195811_add_web_chat_runtime_settings`
- Command run:
  - `DATABASE_URL=postgresql://saga@127.0.0.1:5433/saga_agency_relay_demo?schema=public npx prisma migrate dev --name add_web_chat_runtime_settings`

## Runtime Setting Design

- `WebChatRuntimeSetting`
  - single-row pattern keyed by `"global"`
  - stores requested runtime state plus `updatedAt` and `updatedByAdminSessionId`
- `WebChatRuntimeSettingAudit`
  - append-only audit of flips
  - stores old/new values, actor admin session id, created timestamp
- Effective state:
  - `envFlag === true && dbRow.autonomousEnabled === true`
- Lazy init:
  - first read upserts the `"global"` row using the env flag as the initial value

## Admin UI

- Added runtime state header to `/admin/web-chat-sessions`
- Badge shows effective state:
  - `AUTONOMOUS`
  - `HOLDING`
- Secondary chip shows requested DB state:
  - `requested on`
  - `requested off`
- Toggle submits through a server action behind existing admin auth
- Toggle is disabled when env ceiling is off
- Audit log is rendered inline via a `<details>` disclosure with the newest 20 flips

## Verification

### 1. Migration

```text
Applying migration `20260514195811_add_web_chat_runtime_settings`

The following migration(s) have been created and applied from new schema changes:

prisma/migrations/
  └─ 20260514195811_add_web_chat_runtime_settings/
    └─ migration.sql
```

### 2. Dev server restart after Prisma client generation

The running dev process needed one restart after Prisma generated the new client,
otherwise the old Prisma client shape remained loaded in memory.

```text
✓ Ready in 277ms
```

### 3. Env=true, DB row absent, lazy init creates row and returns autonomous

```text
STEP4 pre-row: null
STEP4 response: {"conversationId":"5a0114b6-5f8c-4c13-b391-7957e9222967","reply":"Great. What city or general location are you thinking for this?","turn":0,"mode":"autonomous"}
STEP4 db row: {"key":"global","autonomousEnabled":true,"updatedAt":"2026-05-14T20:00:21.840Z","updatedByAdminSessionId":null}
```

### 4. Flip to false via admin UI action, then curl with NO restart

This flip was performed through the live admin page button in the in-app browser.
There was no server restart between the UI flip and the next API request.

```text
STEP5 response (no restart after UI flip): {"conversationId":"8681b142-ab99-423f-8ba8-6258dc0765eb","reply":"Thanks - we've logged your message and will reply soon.","turn":0,"mode":"holding"}
STEP5 db row: {"key":"global","autonomousEnabled":false,"updatedAt":"2026-05-14T20:02:45.013Z","updatedByAdminSessionId":"ccc66bc43faf45ecc32f15629b3fd48a3ae02d544c35100c3606968a34f870d1"}
```

### 5. Flip back to true via admin UI action, then curl

```text
STEP6 response: {"conversationId":"faa15160-979b-43fc-b036-1b3cb304d83e","reply":"Great. What city or general location are you thinking for this?","turn":0,"mode":"autonomous"}
STEP6 db row: {"key":"global","autonomousEnabled":true,"updatedAt":"2026-05-14T20:03:10.606Z","updatedByAdminSessionId":"ccc66bc43faf45ecc32f15629b3fd48a3ae02d544c35100c3606968a34f870d1"}
```

### 6. Env=false restart, attempted enable via action returns error, API stays holding

```text
✓ Ready in 267ms
STEP7 action error snippet: The environment ceiling is off, so the runtime toggle cannot enable autonomous replies.
STEP7 response: {"conversationId":"21a2da58-0c96-4e26-91f8-db5f91bcfa63","reply":"Thanks - we've logged your message and will reply soon.","turn":0,"mode":"holding"}
```

### 7. Audit SQL

Command run:

```sql
SELECT old_value, new_value, created_at
FROM "WebChatRuntimeSettingAudit"
ORDER BY created_at DESC
LIMIT 5;
```

Output:

```text
 old_value | new_value |       created_at
-----------+-----------+-------------------------
 f         | t         | 2026-05-14 20:03:10.607
 t         | f         | 2026-05-14 20:02:45.015
(2 rows)
```

### 8. UI smoke

Verified in the in-app browser after restoring env ceiling to `true`:

```json
{
  "hasAutonomous": true,
  "hasSwitch": true,
  "hasAuditLog": true,
  "hasAuditRowTrueFalse": true,
  "hasAuditRowFalseTrue": true
}
```

## Deviations

- The admin flips for steps 5 and 6 were verified through the actual in-app
  browser button instead of a raw shell form post.
  This was intentional because the shell form post path did not reliably invoke
  the server action unless exercised as a real browser submit.
- Step 7 used a direct multipart form post to the same server action endpoint in
  order to prove the env-ceiling error path even though the UI toggle is disabled
  when env is off.

## Notes

- The env flag remains fail-safe:
  - if env is off, the UI cannot effectively enable autonomous replies
  - `/api/web-chat` reads the DB-backed effective state on every request
- No engine, widget, session, or schema outside the runtime-setting path was changed.
