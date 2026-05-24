# Codex Quota Tray

[English](README.en.md) | [中文](README.md)

A Windows tray utility for monitoring multiple ChatGPT Codex Plus accounts through CLIProxyAPI. It summarizes 5H quota, Week quota, daily token usage, and estimated daily cost.

The app is built with Node.js and Electron. It adds a tray icon and a compact always-visible status bar that can be pinned to a desktop corner.

## Features

- Reads Codex accounts managed by CLIProxyAPI.
- Aggregates 5H pool, Week pool, and effective quota across multiple Plus accounts.
- Shows a compact always-visible status bar by default, without requiring tray hover.
- Configurable status bar position: top left, top right, bottom left, bottom right.
- Configurable background opacity from 0% to 100%; text remains fully opaque.
- Supports Chinese and English. Default language is Chinese.
- Account list filters: Ready, All, Unavailable. Ready is the default filter.
- Auto refresh is enabled by default.
- Optional daily token and estimated cost statistics.
- Management key is stored in Electron `userData`; Electron `safeStorage` is used when available.

## Who Is This For?

This tool is useful if you already use CLIProxyAPI to manage multiple ChatGPT/Codex accounts and want a quick Windows desktop view of Codex quota.

This is not an official OpenAI tool. It does not read OpenAI Billing. Daily cost is an API-equivalent estimate based on token usage; it is not a ChatGPT Plus invoice.

## Requirements

Before starting, prepare:

- Windows 10 or Windows 11.
- Node.js 20 or later.
- npm, usually installed with Node.js.
- A running CLIProxyAPI instance.
- CLIProxyAPI Management API URL, for example `http://127.0.0.1:8317`.
- CLIProxyAPI Management API key.
- Codex accounts already hosted in CLIProxyAPI.

Related project and docs:

- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI
- CLIProxyAPI Management API: https://help.router-for.me/cn/management/api

## Beginner Quick Start

### 1. Install Node.js

Open PowerShell and check whether Node.js is available:

```powershell
node -v
npm -v
```

If these commands do not exist, install Node.js first. Node.js 20 or later is recommended.

### 2. Prepare CLIProxyAPI

Start CLIProxyAPI and make sure the Management API is reachable.

Example Management API URL:

```text
http://127.0.0.1:8317
```

Also prepare your Management API key. You will enter it in the app settings panel.

### 3. Clone and Install

```powershell
git clone https://github.com/<your-name>/codex-quota-tray.git
cd codex-quota-tray
npm install
```

If Electron downloads slowly, set a mirror first:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### 4. Start

```powershell
npm start
```

The settings panel opens on first run.

### 5. First-Time Setup

Fill in:

- `Management API URL`: for example `http://127.0.0.1:8317`
- `Management key`: your CLIProxyAPI Management API key

Then click `Save and refresh`.

After setup succeeds, you should see:

- 5H pool remaining percentage
- Week pool remaining percentage
- Effective quota
- Available account count
- Plus account details

## Use Through npm

If you publish this project to npm, users can install it with:

```powershell
npm install -g codex-quota-tray
codex-quota-tray
```

Or run it with:

```powershell
npx codex-quota-tray
```

If the package name is already taken on npm, rename it in `package.json` before publishing.

## Settings

The settings panel includes:

- `Management API URL`: CLIProxyAPI Management API base URL.
- `Management key`: CLIProxyAPI Management API key.
- `Auto refresh`: refreshes real quota on a timer.
- `Today stats`: consumes the usage queue and summarizes daily tokens and estimated cost.
- `Refresh interval`: real quota refresh interval, from 60 to 3600 seconds.
- `Status position`: top left, top right, bottom left, bottom right.
- `Language`: Chinese or English.
- `Background opacity`: 0% to 100%.

You can also provide default values with environment variables:

```powershell
$env:CLIPROXYAPI_BASE_URL='http://127.0.0.1:8317'
$env:CLIPROXYAPI_MANAGEMENT_KEY='your-management-key'
npm start
```

## Status Bar

The native Windows notification area only supports icon slots. It cannot directly host a persistent text segment. This project uses a transparent, frameless, always-on-top mini window placed near the taskbar.

Default status bar content:

```text
5H    57%    Week 93%
Tok   1.8M   $   0.31
```

The right badge shows available account count and total account count, for example `3/3`.

Click the status bar to open the full panel. The tray context menu can hide or show the status bar.

## Plus Pool Calculation

The current implementation assumes all accounts are Plus accounts with equal weight.

For each account:

```text
Account effective quota = min(account 5H remaining percent, account Week remaining percent)
```

For the pool:

```text
5H pool remaining = average 5H remaining percent across measured Plus accounts
Week pool remaining = average Week remaining percent across measured Plus accounts
Effective quota = average account effective quota across measured Plus accounts
Available accounts = accounts with 5H remaining > 0, Week remaining > 0, and rate_limit.allowed=true
```

Do not compute effective quota as:

```text
min(5H pool remaining, Week pool remaining)
```

Different accounts can have different bottlenecks. For example, account A can have 5H = 0 and Week = 100, while account B can have 5H = 100 and Week = 0. Both pool averages are 50, but no account is actually available.

If quota lookup fails for an account, it is excluded from averages. This avoids treating unknown data as real quota.

## Data Sources

After saving settings, the app calls CLIProxyAPI Management API:

- `GET /v0/management/auth-files`: gets hosted account files.
- `POST /v0/management/api-call`: proxies a ChatGPT usage request through each account.

Real quota is read from:

```text
https://chatgpt.com/backend-api/wham/usage
```

## Daily Token and Cost Stats

Daily stats are disabled by default. When enabled, the app:

- Ensures CLIProxyAPI `usage-statistics-enabled` is enabled.
- Reads `GET /v0/management/usage-queue?count=500` every 30 seconds.
- Stores aggregated records in Electron `userData/usage-stats.json`.
- Shows daily total tokens and estimated cost in both the status bar and main panel.

Important notes:

- `usage-queue` is a consumable queue. Records are removed after reading.
- If another stats tool consumes the same queue, results can interfere with each other.
- Cost is an API-equivalent estimate, not a ChatGPT Plus invoice.
- The built-in price table covers common `gpt-5`, `gpt-4.1`, and `gpt-4o` model families.
- Unknown models count toward tokens but not toward cost.

## Local Data Location

Electron stores settings and stats in the app `userData` directory. On Windows it usually looks like:

```text
C:\Users\<you>\AppData\Roaming\codex-quota-tray\
```

Common files:

- `config.json`: app settings. The management key is encrypted with Electron `safeStorage` when supported.
- `usage-stats.json`: local daily token and estimated cost summary.

These files are not stored in the project repository.

## Account Filters

The account details section has three filters:

- `Ready`: default. Shows only currently available accounts.
- `All`: shows all accounts.
- `Unavailable`: shows disabled, unavailable, or quota-unavailable accounts.

## Development

Common commands:

```powershell
npm install
npm start
npm run check
npm audit --omit=optional
```

`npm run check` runs Node.js syntax checks for the main process, renderer scripts, and status bar scripts.

## Project Structure

```text
bin/
  codex-quota-tray.js          npm bin entry
src/
  main.js                      Electron main process, tray, windows, timers
  preload.js                   Secure IPC bridge
  configStore.js               Settings and management key storage
  quotaProvider.js             Real quota reader through CLIProxyAPI
  usageStatsStore.js           Local daily token and estimated cost summary
  trayIcon.js                  Tray icon drawing
  renderer/
    index.html                 Main panel HTML
    renderer.js                Main panel interactions and i18n
    styles.css                 Main panel styles
  statusbar/
    index.html                 Always-visible status bar HTML
    statusbar.js               Status bar rendering
    statusbar.css              Status bar styles
```

## Troubleshooting

### Electron Downloads Slowly

Use a mirror and reinstall:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### The App Says It Is Not Configured

Check:

- CLIProxyAPI is running.
- The Management API URL is correct.
- The Management API key is correct.
- You clicked `Save and refresh`.

### Account List Is Empty

Check:

- CLIProxyAPI has hosted Codex accounts.
- `GET /v0/management/auth-files` returns accounts.
- Accounts are not marked as disabled or unavailable.
- The account filter may be set to `Ready`; switch to `All` to inspect everything.

### Daily Tokens Stay at 0

Check:

- `Today stats` is enabled.
- New requests are going through CLIProxyAPI.
- No other tool is consuming `usage-queue`.
- CLIProxyAPI usage statistics are enabled.

### Chinese Text Is Garbled

Project files must use UTF-8 encoding. Editors should follow `.editorconfig`.

## Security Notes

- Do not commit your Management API key to GitHub.
- The project does not write your management key into the repository.
- Local settings are stored in Electron `userData`.
- When `safeStorage` is available, the management key is encrypted.
- Daily cost is a local estimate and does not read OpenAI official billing.

## Contributing

Issues and pull requests are welcome.

Suggested flow:

1. Fork this repository.
2. Create a feature branch.
3. Make your changes.
4. Run `npm run check`.
5. Open a PR and describe the change and verification steps.

## License

MIT
