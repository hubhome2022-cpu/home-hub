# Home Hub

A family home hub for a Samsung Family Hub fridge screen and our phones: calendar, meals and recipes, chores and projects, fitness, and smart-home devices. It's built to feel like a commercial smart display: instant, calm, glanceable across the kitchen, and it keeps working offline.

| Folder | What's in it |
|---|---|
| `app/` | The app: a no-build web app (Preact + htm), published to GitHub Pages |
| `apps-script/` | The backend: a Google Sheet plus Apps Script web API ([setup guide](apps-script/README.md)) |
| `tests/` | Tests for the chore scheduling math (`cscript //nologo //E:jscript tests\chores_test.js`) |
| `tools/` | A local test server and the icon generator |

- [SHEET_SCHEMA.md](SHEET_SCHEMA.md): every tab and column in the Sheet
- [DEPLOY.md](DEPLOY.md): putting the app on the fridge and phones

**Try it locally:** run `powershell -ExecutionPolicy Bypass -File tools\serve.ps1`, then open `http://localhost:8137/?demo`.

No household data or keys live in this repository. Data lives in the Google Sheet; each device holds the household key it was given at setup.
