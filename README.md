# 📚 文献精读 · Router Paper(预设 + 插件)

DeepSeek Harness 的文献/论文阅读一体化方案:**agent 预设 + 论文插件**,
一次安装,即开即用。

> 论文功能(归档 / 笔记 / 术语 / 检索 / 当前论文记忆)仅在本预设下可用。

## 一键安装

```bash
git clone https://github.com/mrk-king/dsh-preset-literature.git
cd dsh-preset-literature
./install.sh        # 安装 2 个预设目录 + 论文插件 + bundle 注册
# 重启 DeepSeek Harness → 选「📚 文献精读 · Router Paper」→ 开新会话
```

`install.sh` 自动完成:
1. 复制 2 个预设目录(`channel-router` + `router-paper`)到 `~/.dsh/.agent-presets/`
2. 安装论文插件到 `~/.dsh/profiles/web`(npm 失败时自动降级为直接解压)
3. 把插件注册进 profile 的 `dsh.profile.bundles`(harness 加载插件的必要条件)

> 环境变量可覆盖默认路径:`AGENT_PRESETS_DIR` / `DSH_PROFILE_DIR`

## 功能

- **文献精读模式**:文献任务进入学者 persona + 论文核心工具集(`router-paper`)
- **论文工具门控**:`paper_*` 工具仅对 `allowedPresets` 中列出的预设会话开放
- **当前论文记忆**:对话自动注入「当前论文」上下文段;切换论文后自动跟随
  (per-session 独立指针,多对话并行各看各的论文)
- **粘贴自动识别**:同一对话里粘贴另一篇论文的内容时,若文本含其标题,
  自动切换当前论文再归档(多个/无法识别时先询问用户)
- **论文窗口**:自托管 pdf.js 阅读器(缩放/搜索/翻页/旋转;文字可直接选中复制,**图片用
  「🖼 提取图片」一键提取复制/下载**——pdf.js 把页面画在 canvas 上,浏览器无法原生复制画布图片)、
  文件夹多归属管理、按论文隔离的笔记问答、拖 PDF 即入库(标题=文件名)
- **识图自适应**(v0.1.2+):`visionMode=auto` 时,当前会话模型**自带识图**(GPT-4o/Claude/
  Gemini 等)→ 图片直接发给模型,**不依赖 ModLens**;模型无识图能力 → 自动走 ModLens 兜底。

## 目录结构

```
dsh-preset-literature/
├── install.sh               # 一键安装脚本(预设 + 插件 + bundle 注册)
├── presets/                 # 预设目录(安装到 ~/.dsh/.agent-presets/)
│   ├── channel-router/      # 主预设 📚 文献精读 · Router Paper
│   └── router-paper/        # 文献精读核心(学者 persona + 论文任务路由)
└── plugin/                  # dsh-paper-reading 论文插件(源码 + dist/*.tgz)
```

## 手动安装(不跑 install.sh 时)

```bash
# 1) 安装预设
cp -r presets/channel-router presets/router-paper ~/.dsh/.agent-presets/

# 2) 安装插件(tgz 来自 plugin/dist/)
cd ~/.dsh/profiles/web
npm i /path/to/dsh-external-dsh-paper-reading-<version>.tgz

# 3) 注册 bundle:在 profile 的 package.json 中,
#    把 "@dsh-external/dsh-paper-reading" 加入 dsh.profile.bundles 数组

# 4) 重启 DeepSeek Harness → 选「📚 文献精读 · Router Paper」→ 开新会话
```

> 插件包自带 `cordis.patch.yml`(`dsh.bundle.patch` 声明),
> 注册进 `bundles` 后由 harness 自动装配,无需其他配置。

### 组件来源

- **插件独立仓库**:[mrk-king/dsh-paper-reading](https://github.com/mrk-king/dsh-paper-reading)
  (`plugin/` 目录即其快照,含构建产物 `dist/*.tgz`)
- 插件 `allowedPresets` 默认 `["channel-router"]`,即完成门控绑定;
  如需改名/换预设,在插件配置中修改该数组

## 可选依赖:ModLens(图片识别)

- **不是必需**:没有 ModLens 时,插件照常工作,仅**图片解读**相关功能
  (`paper_read_figure` 工具、面板「🖼️ 解读图片」、粘贴图片 OCR)会返回
  明确的提示错误,不影响 PDF 阅读 / 文字归档 / 笔记 / 检索 / 记忆
- **启用方式**:安装 [ModLens](https://github.com/liustack/modlens)(独立 GitHub
  项目)到 web profile 后,插件自动探测(`~/.modlens/config.json` /
  `$MODLENS_BIN` / profile node_modules);也可在插件配置 `modlensBin` 指定
- 对话区「论文阅读」面板状态栏会显示视觉是否就绪(✅/❌);
  `install.sh` 安装时也会自动探测并提示

## 说明

- **只含文献相关组件**:主预设 `channel-router` + 文献精读核心 `router-paper`
  + 论文插件,不含其他渠道委托源
- 其他渠道(官方 API / opencode-go 的非文献任务)的委托源预设未包含,
  对应渠道自动降级为中性 persona;**文献/论文功能不受影响**(本预设定位为文献专用)
- 内部 id 保持 `channel-router`:现有会话绑定与门控依赖该 id;
  显示名「📚 文献精读 · Router Paper」面向用户

## License

MIT;内置 pdf.js 阅读器资源为 Apache-2.0(见 `plugin/assets/pdfjs/LICENSE`)
