# Codex Quota Tray

Windows 托盘小工具原型，用模拟数据展示 ChatGPT Codex 余量和 OpenAI API 预算。

当前版本不调用真实接口，适合先看效果和交互流程。

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

## 全局安装体验

```bash
npm install -g .
codex-quota-tray
```

## 已实现

- Windows 托盘图标
- 默认显示常驻余量文字条
- 动态 tooltip
- 右键菜单
- 状态面板
- 模拟刷新、模拟消耗、模拟重置
- Codex 和 API 两组 mock 额度

说明：Windows 原生通知区域只提供图标槽位，Electron 不能直接把一段文本塞进托盘区域。当前版本使用一个无边框常驻状态条贴近任务栏显示，右键托盘菜单可隐藏或重新显示。

## 后续替换真实数据

真实接口可以放在 `src/quotaProvider.js` 里实现新的 provider，保持输出结构不变即可。
