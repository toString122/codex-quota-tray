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
- 动态 tooltip
- 右键菜单
- 状态面板
- 模拟刷新、模拟消耗、模拟重置
- Codex 和 API 两组 mock 额度

## 后续替换真实数据

真实接口可以放在 `src/quotaProvider.js` 里实现新的 provider，保持输出结构不变即可。
