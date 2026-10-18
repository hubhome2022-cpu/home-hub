# Home Hub — Google Sheet + Apps Script backend

This folder is the hub's data layer: one Google Sheet plus a script attached to it that acts as the hub's web API. Setup takes about 15 minutes in a browser. You don't need to install anything.

| File | What it does |
|---|---|
| `Schema.gs` | Every tab and column (matches `SHEET_SCHEMA.md`) |
| `Store.gs` | Reading and writing rows, settings, change tracking |
| `Setup.gs` | Builds and repairs the tabs, the **Home Hub** menu, the household key |
| `Api.gs` | The web API: key check, `bootstrap`, `sync`, `upsert`, `delete`, `completeChore` |
| `Chores.gs` | Due dates, rotations, points, marking chores done |
| `Triggers.gs` | Nightly backup and chore recompute, tracking hand edits |
| `Seed.gs` | Starter data (rooms, aisles, exercises, about 40 chores) and removable sample data |
| `appsscript.json` | Time zone, permissions, web app settings |

---

## Setup

Do all of this in the **hub's own Google account**, not Jeremy's personal one. Jeremy's account has Advanced Protection turned on, which blocks every script it hasn't approved (including this one) with `Error 400: policy_enforced`.

### 0. The hub account and calendars
**Create the hub account** (one time)
1. Open a **separate Chrome profile** for it (profile icon › **Add**), so it never mixes with your own sign-ins.
2. Create a free Google account, e.g. "Home Hub". Use a long, unique password and save it in your password manager.
3. Turn on **2-Step Verification** with a passkey or an authenticator app. **Don't** enroll this account in Advanced Protection, or it hits the same block.
4. Set the recovery email and phone to Jeremy's.

**Create the Family calendar** (in the hub account)
1. **calendar.google.com › Other calendars › + › Create new calendar.** Name it **Family**, time zone **Central Time**.
2. In its **Settings › Share with specific people**, add Jeremy's and Allison's addresses with **Make changes and manage sharing**.
3. In **Integrate calendar**, copy the **Calendar ID** (it ends in `@group.calendar.google.com`).

**Share your personal calendars with the hub** (Jeremy and Allison each do this from their own account)
1. **calendar.google.com › Settings** (gear) › click your own calendar under **Settings for my calendars**.
2. **Share with specific people › Add people:** the hub account's address, permission **Make changes to events**. This lets the fridge add events to your calendar. Choose **See all event details** if you'd rather it be read-only.
3. In the hub account, open each "shared a calendar with you" email and click **Add this calendar**.

**Optional:** share the **Home Hub Data** spreadsheet with Jeremy's and Allison's own accounts as **Editor**, so you can look at it or hand-edit it from your own accounts. Use the **Home Hub** menu only from the hub account; from Jeremy's account those menu items hit the same Advanced Protection block.

### 1. Create the Sheet and paste the code
1. Go to **sheets.new**. Name the spreadsheet **Home Hub Data**.
2. Open **Extensions › Apps Script**. Rename the project (top left) to **Home Hub**.
3. Click the gear (**Project Settings**) and tick **Show "appsscript.json" manifest file in editor**.
4. Back in the **Editor** (`< >` icon):
   - Open `appsscript.json` and replace everything in it with this folder's `appsscript.json`.
   - Rename `Code.gs` to `Schema` and replace its contents with `Schema.gs`.
   - For each other `.gs` file, click **+ › Script**, give it the same name without `.gs`, and paste the file in.
5. Click **Save** (the disk icon).

### 2. Build the tabs
1. Reload the spreadsheet tab. A **Home Hub** menu appears after a few seconds.
2. **Home Hub › Set up or repair sheet.** Google asks you to authorize the script:
   - Choose your account.
   - Google will say **"Google hasn't verified this app"**. That's expected for a script you wrote yourself. Click **Advanced › Go to Home Hub (unsafe)**, then **Allow**.
   - Run the menu item again if it stopped at the authorization step.
3. **Home Hub › Load starter data.** This adds Jeremy and Allison, rooms, aisles, exercises and the chore library.
4. Optional: **Home Hub › Load sample data** fills in a few recipes, a meal plan, groceries, projects and workouts to try the app with. **Remove sample data** clears them later.
5. **Home Hub › Install nightly jobs.** Approve the extra permission if asked.

### 3. Prune the chore library
Open the **Chores** tab and adjust it to how your house works:
- **Not a chore you do?** Untick `active`, or tick `deleted`.
- **`assign_mode`:** starter chores are `anyone`. Switch a chore to `fixed` (set `assignees` to one person) or `rotate` (you take turns).
- **Trash day:** `Trash and recycling to the curb` is set to Tuesday (`TU`). Change `rule_value` to your actual pickup day.
- **Known dates:** if you know when something was last done, type the right `next_due` date (YYYY-MM-DD).

Edits you make by hand sync to the app on its own.

**Connect the calendars:**
- In the **Settings** tab, put the Family calendar ID in `family_calendar_id`.
- In the **Members** tab, put each person's Gmail address in `calendar_id`. A personal calendar's ID is the account's email address.

The hub starts reading calendars in Phase 3.

**Don't delete rows.** Tick `deleted` instead. Otherwise devices that already copied the row never find out it's gone.

### 4. Publish the API
1. In Apps Script: **Deploy › New deployment**. Click the gear next to "Select type" and choose **Web app**.
2. **Execute as:** Me. **Who has access:** Anyone. Click **Deploy**.
3. Copy the **Web app URL** (it ends in `/exec`). The app will ask for it once, at setup.
4. In the Sheet: **Home Hub › Show household key.** Save it in your password manager. Each device asks for it once.

"Anyone" means anyone with the URL can *reach* the API. Without the household key they get nothing back. The key is never put in a URL.

### 5. Check it works
Paste this into PowerShell, replacing the two placeholders. The result should include `ok : True` and `app : home-hub`:

```powershell
Invoke-RestMethod -Method Post -ContentType 'text/plain' -Uri 'PASTE_WEB_APP_URL' -Body (@{ key = 'PASTE_HOUSEHOLD_KEY'; action = 'ping' } | ConvertTo-Json)
```

A wrong key returns `ok : False` with `bad_key`.

---

## When the code changes later
After pasting updated files, go to **Deploy › Manage deployments**, click the pencil, set **Version: New version** and click **Deploy**. The URL stays the same. If you skip this step, the web app keeps running the old code. That's the most common Apps Script surprise.

After an update that adds columns, run **Home Hub › Set up or repair sheet** again. It only adds what's missing.

---

## API reference (for the app)

`POST` the web app URL with `Content-Type: text/plain` and a JSON body. Every request includes `key` and `action`, plus `member` (the active person's id, e.g. `mem_jeremy`) for anything that writes.

Every response is `{ "ok": true, "data": … }` or `{ "ok": false, "error": { "code", "message" } }`.

| action | send | get back |
|---|---|---|
| `ping` | | `{ app, version, serverTime }` |
| `bootstrap` | | `{ cursor, tables: { Recipes: [rows…], … }, settings: [{ key, value, updated_at }] }`. Everything, including soft-deleted rows. |
| `sync` | `since` (the last `cursor`), `changes` (up to 500, applied in order) | `{ cursor, tables, settings, applied, rejected: [{ index, code, message }] }`. Only rows changed since `since`. |
| `upsert` | `table`, `row` (partial is fine; omit `id` to create) — or `table: "Settings"`, `setting`, `value` | the saved row |
| `delete` | `table`, `id` | the row, now `deleted: true` |
| `completeChore` | `chore_id`, optional `skipped`, `note`, `done_at` | `{ chore, log }`. The chore comes back with its new `next_due` and `next_assignee`. |
| `pair.create` | | `{ code, expiresInSec }`. A 6-digit code that works once, for 10 minutes. |
| `pair.redeem` | `code` (**no key needed**) | `{ key }`. After 10 wrong codes in 10 minutes, every code is refused until the window passes. |

The `changes` list in `sync` takes three kinds of entries:

```json
{ "table": "Grocery", "row": { "id": "grc_k2m8p4q7rt", "name": "Lemons", "checked": true } }
{ "table": "Grocery", "id": "grc_k2m8p4q7rt", "deleted": true }
{ "table": "Settings", "key": "night_start", "value": "21:30" }
```

**Sync notes**
- **Ids:** the app creates them as `<prefix>_<10 random characters>` so rows can be added offline. Prefixes are in `Schema.gs`.
- **Overlap:** each `cursor` re-sends the last 10 seconds of changes. The app should merge rows by `id`, keeping the one with the newest `updated_at`.
- **Last write wins, per field.** A partial row changes only the fields it carries, so Jeremy checking off a grocery item and Allison renaming another never collide.
- **Rejected changes:** a change that fails (bad value, unknown column) comes back in `rejected` and is skipped. The rest still apply, so the app can drop the bad one and keep going.

---

## Tests
The chore scheduling math is covered by `tests\chores_test.js`. It runs on Windows with no installs, and also syntax-checks every `.gs` file:

```powershell
cscript //nologo //E:jscript E:\HomeHub\tests\chores_test.js
```
