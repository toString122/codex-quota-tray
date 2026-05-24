# Codex Quota Tray

[English](README.en.md) | [中文](README.md)

A Windows tray utility based on [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). It monitors multiple ChatGPT Codex Plus accounts and summarizes 5H quota, Week quota, daily token usage, and estimated daily cost.

> This is not an official OpenAI tool and does not read OpenAI Billing. Daily cost is a local estimate based on token usage and OpenAI API standard pricing, not a ChatGPT Plus invoice.

## Preview

![Codex Quota Tray status bar screenshot](171204.png)

## CLIProxyAPI Dependency

Quota information is available only through [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI). This app does not sign in to ChatGPT directly and does not manage Codex accounts by itself. It reads hosted accounts through the CLIProxyAPI Management API, asks CLIProxyAPI to proxy the ChatGPT usage request, and then summarizes the returned quota data.

Before using this app, make sure:

- CLIProxyAPI is running.
- The CLIProxyAPI Management API URL and management key are available.
- The Codex accounts you want to monitor are already hosted in CLIProxyAPI.

## Features

- Aggregates 5H pool, Week pool, and effective quota across multiple Plus accounts.
- Shows each account's 5H / Week percentage and reset time.
- Account filters: Ready, All, Unavailable. Ready is the default.
- Always-visible desktop status bar with top-left, top-right, bottom-left, and bottom-right positions.
- Adjustable status bar background opacity while text stays fully opaque.
- Auto refresh, launch at startup, and Chinese / English UI.
- Optional daily token and estimated cost statistics.
- Stores the management key in Electron `userData`; Electron `safeStorage` is used when available.

## Install

Requirements:

- Windows 10 or Windows 11
- Node.js 20+
- A running CLIProxyAPI instance
- CLIProxyAPI Management API URL and management key
- Codex accounts hosted in CLIProxyAPI

Install globally:

```powershell
npm install -g codex-quota-tray
codex-quota-tray
```

Run with `npx`:

```powershell
npx codex-quota-tray@latest
```

Update:

```powershell
npm install -g codex-quota-tray@latest
```

If an older version is running, quit it from the tray menu before updating.

## First Setup

The settings panel opens on first launch. Fill in:

- `Management API URL`: for example `http://127.0.0.1:8317`
- `Management key`: your CLIProxyAPI Management API key

Click `Save and refresh`. After setup succeeds, the panel shows:

- 5H pool remaining percentage
- Week pool remaining percentage
- Effective quota
- Available account count
- Plus account details

You can also provide defaults with environment variables:

```powershell
$env:CLIPROXYAPI_BASE_URL='http://127.0.0.1:8317'
$env:CLIPROXYAPI_MANAGEMENT_KEY='your-management-key'
codex-quota-tray
```

## Settings

- `Auto refresh`: refreshes real quota on a timer.
- `Today stats`: consumes the CLIProxyAPI usage queue and summarizes daily tokens and estimated cost.
- `Launch at startup`: writes a Windows login item so the app starts after sign-in.
- `Refresh interval`: real quota refresh interval, from 60 to 3600 seconds.
- `Status position`: top left, top right, bottom left, bottom right.
- `Language`: Chinese or English.
- `Background opacity`: 0% to 100%.

## Quota Calculation

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
Available accounts = accounts with 5H > 0, Week > 0, and rate_limit.allowed=true
```

Do not compute effective quota as `min(5H pool remaining, Week pool remaining)`. Different accounts can have different bottlenecks, so pool averages do not prove that any account is usable.

Accounts with failed quota lookup are excluded from averages.

## Data Sources

The app calls CLIProxyAPI Management API:

- `GET /v0/management/auth-files`: reads hosted account files.
- `POST /v0/management/api-call`: proxies a ChatGPT usage request through a selected account.

Real quota is read from:

```text
https://chatgpt.com/backend-api/wham/usage
```

Related project and docs:

- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI
- Management API: https://help.router-for.me/cn/management/api

## Daily Tokens and Cost

Daily stats are disabled by default. When enabled:

- The app ensures CLIProxyAPI `usage-statistics-enabled` is enabled.
- It reads `GET /v0/management/usage-queue?count=500` every 30 seconds.
- It stores summaries in Electron `userData/usage-stats.json`.

Notes:

- `usage-queue` is a consumable queue. Records are removed after reading.
- If another tool consumes the same queue, stats can interfere with each other.
- Cost is estimated with OpenAI Pricing Standard per-1M-token rates.
- Unknown models count toward tokens but not toward cost.

## Local Data

On Windows it usually lives at:

```text
C:\Users\<you>\AppData\Roaming\codex-quota-tray\
```

Common files:

- `config.json`: app settings and encrypted management key.
- `usage-stats.json`: daily token and estimated cost summary.

These files are not written to the project repository.

## Run From Source

```powershell
git clone https://github.com/toString122/codex-quota-tray.git
cd codex-quota-tray
npm install
npm start
```

Checks:

```powershell
npm run check
npm audit --omit=optional
```

If Electron downloads slowly:

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## Troubleshooting

### Not Configured

Check that CLIProxyAPI is running, the Management API URL is correct, the management key is correct, and you clicked `Save and refresh`.

### Account List Is Empty

Make sure CLIProxyAPI has hosted Codex accounts, then switch the account filter to `All`.

### Daily Tokens Stay at 0

Make sure `Today stats` is enabled, new requests are going through CLIProxyAPI, and no other tool is consuming `usage-queue`.

## License

MIT
