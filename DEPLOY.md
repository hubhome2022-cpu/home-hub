# Putting Home Hub on the fridge and your phones

The app is a website hosted free on **GitHub Pages**. Your data stays in the Google Sheet. The website only holds the app itself, so the repository is safe to make public: it contains no data and no household key.

## 1. Update the Sheet's script for pairing (5 minutes)
Pairing lets the fridge connect with a 6-digit code instead of the 64-character key.

1. In the hub account's Chrome profile, open **Home Hub Data › Extensions › Apps Script**.
2. Replace the contents of **Api** with `apps-script/Api.gs` and **Schema** with `apps-script/Schema.gs`. Click **Save**.
3. **Deploy › Manage deployments ›** pencil **› Version: New version › Deploy.** The URL stays the same.

## 2. Make a fresh household key
The current key was shared in chat while testing. In the Sheet: **Home Hub › Make a new household key**. Save the new key in your password manager.

## 3. Publish the app (one time, about 10 minutes)
1. Create a free account at **github.com** (or sign in).
2. Click **+ › New repository**. Name it `home-hub`, set it to **Public** (free GitHub Pages needs a public repository), and don't add a README. Click **Create repository**.
3. In the new repository: **Settings › Pages › Source: GitHub Actions**.
4. Tell Claude the repository address. Claude commits the project and pushes it. The first push opens a GitHub sign-in window; sign in there.
5. Watch the **Actions** tab. When the "Publish the app" run turns green (about a minute), the app is live at `https://<your-username>.github.io/home-hub/`.

## 4. Set up the devices
**Your phone first** (it can paste the key):
1. Open `https://<your-username>.github.io/home-hub/` in Chrome or Safari.
2. Choose **Household key**, paste it, and tap **Connect**.
3. Install it like an app. On Android: menu **› Add to Home screen**. On iPhone: **Share › Add to Home Screen**.

**The fridge:**
1. On the Family Hub, open the **Internet** app and go to the same address. Bookmark it.
2. On your phone: **avatar › Settings › Add another device › Show a pairing code.**
3. On the fridge: choose **Pairing code**, enter the 6 digits, then tap **Connect**.
4. On the fridge: **Settings › Browser check › Show**. Tell Claude the **Chromium version** so later phases stay compatible with it.

**Allison's phone:** same as the fridge, with a pairing code from your phone.

## Updating later
Each change Claude makes is pushed to GitHub, and the site updates within a minute or two. Devices switch to the new version on their own: the fridge waits until nobody's using it, and phones switch the next time the app is opened.

## Trying it without real data
Add `?demo` to the address to explore with sample data that stays in that browser. **Settings › Remove this device** leaves demo mode.
