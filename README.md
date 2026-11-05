# Focus Ledger for Firefox

Focus Ledger is a local-first Firefox extension that helps you understand where browser time goes. It records only time spent in the active, focused tab and turns it into a simple productivity report.

## What it does

- Records active time for normal `http` and `https` tabs.
- Stops recording after one minute of system idle time and when Firefox is not focused.
- Lets you classify a website as **Productive**, **Distracting**, or **Neutral**.
- Shows totals for the current browser session, today, this week, or a custom date range.
- Retains at most 14 days of data; custom ranges are therefore limited to those 14 days.
- Includes a local visualization, category breakdown, and ranked domains.
- Lets you set a daily time limit per website.
- Shows the current website's daily timer directly in the toolbar popup. Set a limit, add 15 minutes, or remove the timer without typing a URL.
- Sends a Firefox notification when a daily limit is reached. Its actions add 15 minutes or remove the limit.

## Privacy and data security

Focus Ledger is designed so your browsing record stays on your device.

### Data it stores locally

- domain, for example `youtube.com`
- a shortened tab title (maximum 160 characters)
- category, start time, end time, and duration
- your category rules, theme preference, and site-limit settings

### Data it never reads or sends

- page text, screenshots, video, messages, form fields, or keystrokes
- passwords, cookies, downloads, bookmarks, or browsing history
- private/incognito tabs
- URL query strings or URL paths in stored activity records
- any activity data to a server, analytics provider, or AI service

The toolbar popup reads only the active tab's hostname in order to show that website's timer. It does not inspect page content. Extension data lives in Firefox's local extension storage and can be erased with **Clear local history** in the dashboard.

## Install for development

1. Open Firefox and visit `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `manifest.json` from this folder.
4. Pin the Focus Ledger toolbar button if Firefox does not show it automatically.
5. Click the toolbar button to classify the current site or open the dashboard.

Temporary add-ons are removed when Firefox restarts. A permanent distribution needs Firefox extension signing and packaging.

## How tracking works

The background process starts a timing segment when the active tab is a non-private web page. It closes that segment whenever you change tabs, navigate, become idle, or leave Firefox. Closed segments are saved locally and summed by domain, category, and selected time range.

The toolbar popup asks the background process only for the current hostname's daily total and optional limit. It has no access to page content.

## Project files

- `manifest.json` — Firefox permissions and toolbar configuration
- `background.js` — tracking, local storage, limits, and notifications
- `popup.*` — toolbar popup and one-click classification
- `dashboard.*` — reports, custom date range, visualization, settings
- `icon.svg` — Focus Ledger toolbar/tab icon

## Known limitation

“Productive” is personal. The extension starts with editable domain rules, but a domain such as YouTube can be productive or distracting depending on what you are doing. Adjust the rules to fit your work.
