# Codex Quota Tray

Windows 托盘小工具，通过 CLIProxyAPI Management API 读取真实 Codex 账号并汇总显示 Plus 账号池的 5H 和 Week 额度。

## 运行

```bash
npm install
npm start
```

如果 Electron 二进制下载很慢，可以在 PowerShell 里使用镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

## 首次配置

首次运行会自动打开状态面板。填写：

- `Management API 地址`，例如 `http://127.0.0.1:8317`
- `管理密钥`，即 CLIProxyAPI 的 Management API key

保存后，工具会调用：

- `GET /v0/management/auth-files` 获取 Codex 账号列表
- `POST /v0/management/api-call` 按账号代理请求 `https://chatgpt.com/backend-api/wham/usage`

管理密钥保存在 Electron `userData/config.json`，支持 Electron `safeStorage` 时会加密保存。

## 显示内容

- Windows 托盘图标
- 默认常驻余量文字条
- 状态面板
- CLIProxyAPI 配置表单
- 可配置自动刷新
- 可选今日 token 和估算金额统计
- 可配置状态条位置、背景透明度和语言
- 真实 Codex Plus 账号明细
- 5H 池、Week 池、有效余量和可用账号数

说明：Windows 原生通知区域只提供图标槽位，Electron 不能直接把一段文本塞进托盘区域。当前版本使用无边框常驻状态条贴近任务栏显示，右键托盘菜单可隐藏或重新显示。

## Plus 账号池计算口径

所有账号都是 Plus 时，每个账号权重相同。

```text
账号有效余量 = min(该账号 5H 剩余, 该账号 Week 剩余)
5H 池剩余 = 所有已测 Plus 账号的 5H 剩余百分比平均值
Week 池剩余 = 所有已测 Plus 账号的 Week 剩余百分比平均值
有效余量 = 所有已测 Plus 账号的账号有效余量平均值
可用账号 = 5H 剩余 > 0 且 Week 剩余 > 0 且 rate_limit.allowed=true 的账号数量
```

如果某个账号的 quota 查询失败，会在账号明细中显示错误，并且不参与平均值，避免把未知数据伪装成真实余量。

不能直接用 `min(5H 池剩余, Week 池剩余)`，因为不同账号的瓶颈可能不同。例如一个账号 5H 为 0、Week 为 100，另一个账号 5H 为 100、Week 为 0，两个池平均都是 50，但实际没有任何可用账号。

## 自动刷新

自动刷新默认开启，默认间隔 300 秒。可以在状态面板的 CLIProxyAPI 配置区域调整：

- 关闭或开启自动刷新
- 设置刷新间隔，范围 60 到 3600 秒

保存配置后会立即刷新一次，并按新的间隔重排后台定时器。

## 今日用量统计

今日统计默认关闭。开启后，工具会：

- 自动确保 CLIProxyAPI `usage-statistics-enabled` 为开启状态
- 每 30 秒读取 `GET /v0/management/usage-queue?count=500`
- 将读取到的记录汇总保存到 Electron `userData/usage-stats.json`
- 在状态条显示今日总 token 和估算金额

注意：`usage-queue` 是消费型队列，读取后记录会从队列移除。如果同时运行其它消费该队列的统计工具，可能会互相影响。

金额是 API 等价估算，不是 ChatGPT Plus 账单。当前内置价格表覆盖常见 `gpt-5`、`gpt-4.1`、`gpt-4o` 系列；未知模型会计入 token，但不会计入金额。

## 状态条显示

状态条默认使用中文界面。可在配置区调整：

- 位置：左上方、右上方、左下方、右下方
- 背景透明度：0% 到 100%，只影响背景，不影响文字
- 语言：中文或 English

开启今日统计后，状态条第二行会显示 `Tok` 和 `$`，分别表示今日累计 token 和今日估算金额。
