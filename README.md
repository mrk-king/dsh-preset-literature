# 📚 文献精读 · Router Paper(预设 + 插件全家桶)

DeepSeek Harness 的文献/论文阅读一体化方案:**agent 预设 + 论文插件**,
一次安装,即开即用。

> 论文功能(归档 / 笔记 / 术语 / 检索 / 当前论文记忆)仅在本预设下可用;
> 其他任务按渠道自适应路由(官方 API 与 opencode-go 分渠道调度)。

## 一键安装

```bash
git clone https://github.com/mrk-king/dsh-preset-literature.git
cd dsh-preset-literature
./install.sh        # 安装 7 个预设目录 + 论文插件
# 重启 DeepSeek Harness → 选「📚 文献精读 · Router Paper」→ 开新会话
```

`install.sh` 自动完成:
1. 复制 7 个预设目录到 `~/.dsh/.agent-presets/`
2. 安装论文插件到 `~/.dsh/profiles/web`(npm 失败时自动降级为直接解压)

> 环境变量可覆盖默认路径:`AGENT_PRESETS_DIR` / `DSH_PROFILE_DIR`

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
├── install.sh               # 一键安装脚本
├── presets/                 # 预设目录(安装到 ~/.dsh/.agent-presets/)
│   ├── channel-router/      # 主预设 📚 文献精读 · Router Paper
│   └── router-paper/        # 文献精读核心(学者 persona + 论文任务路由)
└── plugin/                  # dsh-paper-reading 论文插件(源码 + dist/*.tgz)
```

## 安装

```bash
# 1) 把 presets/ 下各目录复制到 agent-presets 根目录
cp -r presets/channel-router presets/router-paper ~/.dsh/.agent-presets/

# 2) 重启 DeepSeek Harness(或刷新预设列表)

# 3) 在预设选择器中选择「📚 文献精读 · Router Paper」
#    (可设为默认预设)
```

### 组件来源

- **插件独立仓库**:[mrk-king/dsh-paper-reading](https://github.com/mrk-king/dsh-paper-reading)
  (`plugin/` 目录即其快照,含构建产物 `dist/*.tgz`)
- 插件配置中将 `allowedPresets` 设为 `["channel-router"]`(默认值)即完成门控绑定

## 可选依赖:ModLens(图片识别)

- **不是必需**:没有 ModLens 时,插件照常工作,仅**图片解读**相关功能
  (`paper_read_figure` 工具、面板「🖼️ 解读图片」、粘贴图片 OCR)会返回
  明确的提示错误,不影响 PDF 阅读 / 文字归档 / 笔记 / 检索 / 记忆
- **启用方式**:安装 [ModLens](https://github.com/liustack/modlens)(独立 GitHub
  项目)到 web profile 后,插件自动探测(`~/.modlens/config.json` /
  `$MODLENS_BIN` / profile node_modules);也可在插件配置 `modlensBin` 指定
- 论文窗口状态栏会显示视觉是否就绪(✅/❌);`install.sh` 安装时会自动探测并提示

## 说明

- **只含文献相关组件**:主预设 `channel-router`(文献精读 · Router Paper)
  + 文献精读核心 `router-paper` + 论文插件;不含其他渠道委托源
- 渠道委托源(官方 API / opencode-go 的各渠道预设)未包含:
  对应渠道自动降级为中性 persona,文献/论文功能不受影响(以文献用途为主)
- 内部 id 保持 `channel-router`:现有会话绑定与门控依赖该 id;
  显示名「📚 文献精读 · Router Paper」面向用户

## License

MIT(各源预设目录保留其自带 LICENSE)
