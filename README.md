# Codex Quota Tray

[中文](README.md) | [English](README.en.md)

基于 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 的 Windows 托盘状态栏工具，用于汇总多个 ChatGPT Codex Plus 账号的 5H 额度、Week 额度、今日 token 用量和估算金额。

> 这不是 OpenAI 官方工具，不读取 OpenAI Billing。今日金额是基于 token 和 OpenAI API 标准价格的本地估算，不是 ChatGPT Plus 账单。

## 预览

![Codex Quota Tray 状态条截图](171204.png)

## CLIProxyAPI 依赖

余量信息必须通过 [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) 才能读取。本工具不会直接登录 ChatGPT，也不会直接管理 Codex 账号；它通过 CLIProxyAPI 的 Management API 获取已托管账号列表，并让 CLIProxyAPI 代理请求 ChatGPT usage 接口后汇总展示余量。

使用前请先确认：

- CLIProxyAPI 已运行。
- CLIProxyAPI Management API 地址和管理密钥可用。
- 需要查看余量的 Codex 账号已经托管到 CLIProxyAPI。

## 功能

- 汇总多个 Plus 账号的 5H 池、Week 池和有效余量。
- 账号明细显示每个账号的 5H / Week 百分比和刷新时间。
- 账号过滤：可用、全部、不可用，默认显示可用账号。
- 常驻桌面状态条，支持左上、右上、左下、右下固定。
- 状态条背景透明度可调，文字保持不透明。
- 自动刷新、开机自启、中文 / English 切换。
- 可选今日 token 和估算金额统计。
- 管理密钥保存在 Electron `userData`，支持 `safeStorage` 时会加密保存。

## 安装

要求：

- Windows 10 或 Windows 11
- Node.js 20+
- 已运行的 CLIProxyAPI
- CLIProxyAPI Management API 地址和管理密钥
- CLIProxyAPI 中已托管 Codex 账号

全局安装：

```powershell
npm install -g codex-quota-tray
codex-quota-tray
```

使用 `npx` 运行：

```powershell
npx codex-quota-tray@latest
```

更新：

```powershell
npm install -g codex-quota-tray@latest
```

如果旧版正在运行，先从托盘菜单退出，再执行更新命令。

## 首次配置

首次启动会打开配置面板，填写：

- `Management API 地址`：例如 `http://127.0.0.1:8317`
- `管理密钥`：CLIProxyAPI Management API key

点击 `保存并刷新` 后会显示：

- 5H 池剩余百分比
- Week 池剩余百分比
- 有效余量
- 可用账号数量
- Plus 账号明细

也可以用环境变量提供默认值：

```powershell
$env:CLIPROXYAPI_BASE_URL='http://127.0.0.1:8317'
$env:CLIPROXYAPI_MANAGEMENT_KEY='your-management-key'
codex-quota-tray
```

## 配置项

- `自动刷新`：按固定间隔刷新真实额度。
- `今日统计`：采集 CLIProxyAPI usage queue，汇总今日 token 和估算金额。
- `开机自启`：写入 Windows 登录项，系统启动后自动运行。
- `刷新间隔`：真实额度刷新间隔，范围 60 到 3600 秒。
- `状态条位置`：左上、右上、左下、右下。
- `语言`：中文或 English。
- `背景透明度`：0% 到 100%。

## 额度计算

当前假设所有账号都是 Plus，且权重相同。

单个账号：

```text
账号有效余量 = min(该账号 5H 剩余百分比, 该账号 Week 剩余百分比)
```

账号池：

```text
5H 池剩余 = 已测 Plus 账号 5H 剩余百分比平均值
Week 池剩余 = 已测 Plus 账号 Week 剩余百分比平均值
有效余量 = 已测 Plus 账号有效余量平均值
可用账号 = 5H > 0、Week > 0 且 rate_limit.allowed=true 的账号
```

不要直接使用 `min(5H 池剩余, Week 池剩余)`。不同账号的瓶颈可能不同，池平均值不能代表真实可用账号数。

查询失败的账号不会参与平均值，避免把未知数据当成真实余量。

## 数据来源

工具调用 CLIProxyAPI Management API：

- `GET /v0/management/auth-files`：读取托管账号列表。
- `POST /v0/management/api-call`：通过指定账号代理请求 ChatGPT usage 接口。

真实额度来自：

```text
https://chatgpt.com/backend-api/wham/usage
```

相关项目和文档：

- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI
- Management API: https://help.router-for.me/cn/management/api

## 今日 token 和金额

今日统计默认关闭。开启后：

- 自动确保 CLIProxyAPI `usage-statistics-enabled` 已开启。
- 每 30 秒读取 `GET /v0/management/usage-queue?count=500`。
- 汇总保存到 Electron `userData/usage-stats.json`。

注意：

- `usage-queue` 是消费型队列，读取后记录会从队列移除。
- 如果其它工具也在消费该队列，统计会互相影响。
- 金额按 OpenAI Pricing 页面的 Standard 每 100 万 token 价格估算。
- 未知模型会计入 token，但不会计入金额。

## 本地数据

Windows 上通常位于：

```text
C:\Users\<you>\AppData\Roaming\codex-quota-tray\
```

常见文件：

- `config.json`：应用配置和加密后的管理密钥。
- `usage-stats.json`：今日 token 和估算金额汇总。

这些文件不会写入项目仓库。

## 源码运行

```powershell
git clone https://github.com/toString122/codex-quota-tray.git
cd codex-quota-tray
npm install
npm start
```

检查：

```powershell
npm run check
npm audit --omit=optional
```

如果 Electron 下载慢：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 常见问题

### 显示未配置

检查 CLIProxyAPI 是否运行、Management API 地址是否正确、管理密钥是否正确，并确认已经点击 `保存并刷新`。

### 账号列表为空

确认 CLIProxyAPI 已托管 Codex 账号，并切换账号过滤到 `全部` 查看。

### 今日 token 一直是 0

确认已开启 `今日统计`，有新请求经过 CLIProxyAPI，并且没有其它工具消费 `usage-queue`。


## License

MIT
