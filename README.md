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

## Plus 账号池计算口径

所有账号都是 Plus 时，每个账号权重相同。

```text
5H 池剩余 = 所有启用 Plus 账号的 5H 剩余百分比平均值
周池剩余 = 所有启用 Plus 账号的周剩余百分比平均值
有效余量 = min(5H 池剩余, 周池剩余)
可用账号 = 5H 剩余 > 0 且周剩余 > 0 的账号数量
```

如果后续加入 Pro 账号，再把权重从固定 `1` 扩展为 `Plus=1`、`Pro 5x=5`、`Pro 20x=20` 即可。
