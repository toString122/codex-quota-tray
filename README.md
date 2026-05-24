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
- 真实 Codex Plus 账号明细
- 5H 池、Week 池、有效余量和可用账号数

说明：Windows 原生通知区域只提供图标槽位，Electron 不能直接把一段文本塞进托盘区域。当前版本使用无边框常驻状态条贴近任务栏显示，右键托盘菜单可隐藏或重新显示。

## Plus 账号池计算口径

所有账号都是 Plus 时，每个账号权重相同。

```text
5H 池剩余 = 所有已测 Plus 账号的 5H 剩余百分比平均值
Week 池剩余 = 所有已测 Plus 账号的 Week 剩余百分比平均值
有效余量 = min(5H 池剩余, Week 池剩余)
可用账号 = 5H 剩余 > 0 且 Week 剩余 > 0 且 rate_limit.allowed=true 的账号数量
```

如果某个账号的 quota 查询失败，会在账号明细中显示错误，并且不参与平均值，避免把未知数据伪装成真实余量。
