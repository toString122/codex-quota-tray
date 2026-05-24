# Codex Quota Tray

一个 Windows 托盘小工具，用于通过 CLIProxyAPI 汇总查看多个 ChatGPT Codex Plus 账号的 5H 额度、Week 额度、今日 token 用量和估算金额。

项目基于 Node.js 和 Electron。启动后会显示一个托盘图标，并在桌面角落显示可配置的常驻状态条。

## 功能特性

- 读取 CLIProxyAPI 托管的 Codex 账号列表。
- 汇总多个 Plus 账号的 5H 池、Week 池和有效余量。
- 默认常驻显示紧凑状态条，不需要悬停托盘图标。
- 状态条位置可选：左上、右上、左下、右下。
- 背景透明度可调，范围 0% 到 100%，只影响背景，不影响文字。
- 支持中文和 English，默认中文。
- 账号列表支持过滤：可用、全部、不可用，默认只显示可用账号。
- 支持自动刷新，默认开启。
- 可选今日 token 和估算金额统计。
- 管理密钥保存在 Electron `userData` 中，支持 `safeStorage` 时会加密保存。

## 适用场景

这个工具适合已经使用 CLIProxyAPI 管理多个 ChatGPT/Codex 账号，并希望在 Windows 桌面上快速查看 Codex 余量的人。

它不是 OpenAI 官方工具，也不会直接读取你的 OpenAI Billing。今日金额是基于 token 的 API 等价估算，不是 ChatGPT Plus 账单。

## 前置要求

新手需要先准备：

- Windows 10 或 Windows 11。
- Node.js 20 或更高版本。
- npm，通常随 Node.js 一起安装。
- 一个正在运行的 CLIProxyAPI 实例。
- CLIProxyAPI Management API 地址，例如 `http://127.0.0.1:8317`。
- CLIProxyAPI Management API key。
- CLIProxyAPI 中已经托管好 Codex 账号。

相关项目和文档：

- CLIProxyAPI: https://github.com/router-for-me/CLIProxyAPI
- CLIProxyAPI Management API: https://help.router-for.me/cn/management/api

## 新手快速开始

### 1. 安装 Node.js

打开 PowerShell，检查 Node.js 是否可用：

```powershell
node -v
npm -v
```

如果命令不存在，先安装 Node.js。建议使用 Node.js 20 或更高版本。

### 2. 准备 CLIProxyAPI

先启动你的 CLIProxyAPI，并确认 Management API 可以访问。

假设你的 Management API 地址是：

```text
http://127.0.0.1:8317
```

同时准备好你的 Management API key。这个 key 后续会填入工具的配置界面。

### 3. 克隆并安装项目

```powershell
git clone https://github.com/<your-name>/codex-quota-tray.git
cd codex-quota-tray
npm install
```

如果 Electron 下载很慢，可以先设置镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### 4. 启动

```powershell
npm start
```

首次运行时，工具会打开配置面板。

### 5. 首次配置

在配置面板中填写：

- `Management API 地址`：例如 `http://127.0.0.1:8317`
- `管理密钥`：CLIProxyAPI 的 Management API key

然后点击 `保存并刷新`。

配置成功后，你会看到：

- 5H 池剩余百分比
- Week 池剩余百分比
- 有效余量
- 可用账号数量
- Plus 账号明细

## 通过 npm 使用

如果你把项目发布到 npm，可以用：

```powershell
npm install -g codex-quota-tray
codex-quota-tray
```

也可以使用：

```powershell
npx codex-quota-tray
```

注意：如果 npm 上的包名已被占用，需要在 `package.json` 中改成你自己的包名。

## 配置项说明

配置面板包含：

- `Management API 地址`：CLIProxyAPI Management API base URL。
- `管理密钥`：CLIProxyAPI Management API key。
- `自动刷新`：开启后按固定间隔刷新真实额度。
- `今日统计`：开启后采集 usage queue 并汇总今日 token 和估算金额。
- `刷新间隔`：真实额度刷新间隔，范围 60 到 3600 秒。
- `状态条位置`：左上、右上、左下、右下。
- `语言`：中文或 English。
- `背景透明度`：0% 到 100%。

也可以用环境变量提供默认值：

```powershell
$env:CLIPROXYAPI_BASE_URL='http://127.0.0.1:8317'
$env:CLIPROXYAPI_MANAGEMENT_KEY='your-management-key'
npm start
```

## 状态条说明

Windows 原生通知区域只能放图标，不能直接放一段常驻文本。这个项目使用一个无边框、透明背景、始终置顶的小窗口贴近任务栏显示状态。

状态条默认显示：

```text
5H    57%    Week 93%
Tok   1.8M   $   0.31
```

右侧徽标显示可用账号数和总账号数，例如 `3/3`。

点击状态条会打开完整面板。托盘右键菜单可以隐藏或重新显示状态条。

## Plus 账号池计算口径

当前假设所有账号都是 Plus，所有账号权重相同。

单个账号：

```text
账号有效余量 = min(该账号 5H 剩余百分比, 该账号 Week 剩余百分比)
```

账号池：

```text
5H 池剩余 = 所有已测 Plus 账号 5H 剩余百分比的平均值
Week 池剩余 = 所有已测 Plus 账号 Week 剩余百分比的平均值
有效余量 = 所有已测 Plus 账号的账号有效余量平均值
可用账号 = 5H 剩余 > 0、Week 剩余 > 0 且 rate_limit.allowed=true 的账号数量
```

不要直接使用：

```text
min(5H 池剩余, Week 池剩余)
```

因为不同账号的瓶颈可能不同。例如账号 A 的 5H 为 0、Week 为 100，账号 B 的 5H 为 100、Week 为 0。两个池的平均值都是 50，但实际上没有任何可用账号。

如果某个账号 quota 查询失败，它不会参与平均值，避免把未知数据伪装成真实余量。

## 数据来源

保存配置后，工具会调用 CLIProxyAPI Management API：

- `GET /v0/management/auth-files`：获取托管账号列表。
- `POST /v0/management/api-call`：按账号代理请求 ChatGPT usage 接口。

真实额度来自：

```text
https://chatgpt.com/backend-api/wham/usage
```

## 今日 token 和金额统计

今日统计默认关闭。开启后，工具会：

- 自动确保 CLIProxyAPI `usage-statistics-enabled` 为开启状态。
- 每 30 秒读取 `GET /v0/management/usage-queue?count=500`。
- 将读取到的记录汇总保存到 Electron `userData/usage-stats.json`。
- 在状态条和主面板显示今日总 token 和估算金额。

重要注意：

- `usage-queue` 是消费型队列，读取后记录会从队列移除。
- 如果你同时运行其它消费该队列的统计工具，统计结果可能互相影响。
- 金额是 API 等价估算，不是 ChatGPT Plus 账单。
- 当前内置价格表覆盖常见 `gpt-5`、`gpt-4.1`、`gpt-4o` 系列。
- 未知模型会计入 token，但不会计入金额。

## 本地数据保存位置

Electron 会把配置和统计保存到应用的 `userData` 目录。Windows 上通常类似：

```text
C:\Users\<you>\AppData\Roaming\codex-quota-tray\
```

常见文件：

- `config.json`：应用配置。管理密钥在系统支持时会使用 Electron `safeStorage` 加密。
- `usage-stats.json`：今日 token 和估算金额的本地汇总。

这些文件不会保存在项目仓库里。

## 账号过滤

账号明细区提供三个过滤选项：

- `可用`：默认选项，只显示当前可用账号。
- `全部`：显示所有账号。
- `不可用`：显示 disabled、unavailable 或额度不可用的账号。

## 开发

常用命令：

```powershell
npm install
npm start
npm run check
npm audit --omit=optional
```

`npm run check` 会对主进程、渲染进程和状态条脚本做 Node.js 语法检查。

## 项目结构

```text
bin/
  codex-quota-tray.js          npm bin 启动入口
src/
  main.js                      Electron 主进程、托盘、窗口、定时刷新
  preload.js                   安全暴露 IPC API
  configStore.js               配置读写和管理密钥保存
  quotaProvider.js             CLIProxyAPI 真实额度读取
  usageStatsStore.js           今日 token 和估算金额本地汇总
  trayIcon.js                  托盘图标绘制
  renderer/
    index.html                 主面板 HTML
    renderer.js                主面板交互和多语言
    styles.css                 主面板样式
  statusbar/
    index.html                 常驻状态条 HTML
    statusbar.js               状态条渲染
    statusbar.css              状态条样式
```

## 故障排查

### Electron 下载很慢

使用镜像重新安装：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm install
```

### 显示未配置

检查：

- CLIProxyAPI 是否正在运行。
- Management API 地址是否正确。
- Management API key 是否正确。
- 是否点击过 `保存并刷新`。

### 账号列表为空

检查：

- CLIProxyAPI 是否已经托管 Codex 账号。
- `GET /v0/management/auth-files` 是否能返回账号。
- 账号是否被标记为 disabled 或 unavailable。
- 账号过滤是否停留在 `可用`，可以切到 `全部` 查看。

### 今日 token 一直是 0

检查：

- 是否开启了 `今日统计`。
- 是否有新的请求经过 CLIProxyAPI。
- 是否有其它工具正在消费 `usage-queue`。
- CLIProxyAPI 是否启用了 usage statistics。

### 中文乱码

项目文件必须使用 UTF-8 编码。编辑器建议遵循 `.editorconfig`。

## 安全说明

- 不要把你的 Management API key 提交到 GitHub。
- 项目不会把管理密钥写入仓库。
- 本地配置保存在 Electron `userData`。
- 支持 `safeStorage` 时，管理密钥会加密保存。
- 今日金额只是本地估算，不会读取 OpenAI 官方账单。

## 贡献

欢迎提交 issue 和 pull request。

建议流程：

1. Fork 本仓库。
2. 创建功能分支。
3. 修改代码。
4. 运行 `npm run check`。
5. 提交 PR，并说明变更内容和验证方式。

## License

MIT
