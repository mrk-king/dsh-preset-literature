# 📚 文献精读 · Router Paper

DeepSeek Harness 的文献/论文阅读专用 agent 预设(内部 id: `channel-router`)。

> 论文功能(归档 / 笔记 / 术语 / 检索 / 当前论文记忆)仅在本预设下可用;
> 其他任务按渠道自适应路由(官方 API 与 opencode-go 分渠道调度)。

## 功能

- **文献精读模式**:文献任务进入学者 persona + 论文核心工具集
- **论文工具门控**:`paper_*` 工具仅对 `allowedPresets` 中列出的预设会话开放
- **当前论文记忆**:对话自动注入「当前论文」上下文段;切换论文后自动跟随(per-session 独立指针)
- **渠道自适应路由**:
  - 官方 API:flash → `router-standard`(spec/react 任务路由)/ pro → `anchored-standard` / 其他 → `warmupbetter`
  - opencode-go:flash → `router-flash`(w7 神模式)/ 其他 → `warmupbetter-replay`
  - 文献任务优先进入精读模式(`router-paper`),不随渠道变化

## 目录结构

```
dsh-preset-literature/
├── channel-router/          # 主预设(文献精读 · Router Paper)
│   ├── agent.cordis.yml     # 预设组合声明
│   ├── preset.yml           # 显示名/描述/排序
│   ├── channel-core.mjs     # 渠道矩阵与检测(零依赖)
│   └── channel-router-bootstrap.mjs  # 渠道自适应路由插件
├── router-standard/         # 官方 flash 渠道委托源
├── router-flash/            # opencode flash 渠道委托源
├── anchored-standard/       # 官方 pro 渠道委托源
├── warmupbetter/            # 官方其他渠道委托源(含 LICENSE.deepseek-harness)
├── warmupbetter-replay/     # opencode 其他渠道委托源(含 LICENSE.deepseek-harness)
└── router-paper/            # 文献精读核心(persona + 论文工具路由)
```

## 安装

```bash
# 1) 把各预设目录复制到 agent-presets 根目录
cp -r channel-router router-standard router-flash anchored-standard \
      warmupbetter warmupbetter-replay router-paper \
      ~/.dsh/.agent-presets/

# 2) 重启 DeepSeek Harness(或刷新预设列表)

# 3) 在预设选择器中选择「📚 文献精读 · Router Paper」
#    (可设为默认预设)
```

### 前置依赖

论文工具(`paper_*`)与论文窗口由独立的 **dsh-paper-reading 插件**提供,
本仓库不含该插件。安装插件后,在插件配置中将 `allowedPresets`
设为 `["channel-router"]`(默认值)即完成门控绑定。

## 说明

- 内部 id 保持 `channel-router`:现有会话绑定与门控依赖该 id;
  显示名「📚 文献精读 · Router Paper」面向用户
- `warmupbetter` / `warmupbetter-replay` 源自 DeepSeek Harness 社区,
  各目录内保留其原始 `LICENSE.deepseek-harness`
- 其他预设(如 `dsh-minimal-v3`、`standard-vision`、`zero-anchored-standard`)
  与本预设无依赖,不包含在本仓库

## License

MIT(各源预设目录保留其自带 LICENSE)
