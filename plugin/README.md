# 📄 dsh-paper-reading — DeepSeek Harness 论文阅读伴侣

文献阅读插件:把论文 PDF、复制文字、图表交给 AI 解读、整理与归档,
配套论文窗口(自托管 pdf.js 阅读器、文件夹/多标签管理、按论文记忆的笔记问答)。

> 配合预设 **[dsh-preset-literature](https://github.com/mrk-king/dsh-preset-literature)**
> (📚 文献精读 · Router Paper)使用:论文功能仅在该预设下开放。

## 功能

- **🧹 文字清洗归档**:PDF 复制出来的乱排版(页码、断行、连字符、重复页眉)
  自动修复,归档到当前论文,并按内容去重
- **📄 PDF 论文**:拖入 PDF → 自动入库(标题=文件名)+ `pdftotext` 全文提取;
  **论文窗口内自托管 pdf.js legacy 阅读器**(缩放/搜索/翻页/旋转,文字图片可选中复制)
- **🖼️ 图片解读**:选图/粘贴图片 → ModLens OCR 转录 → 归档 → 发送给 AI 解读
- **📒 论文库与文件夹**:每篇论文独立笔记(`notes.md` 问答片段、`figures.md`
  图表转录、`glossary.md` 术语表);文件夹系统支持**多文件夹归属**(虚拟收藏集)、
  过滤、拖入归类、新建/重命名/删除
- **🧠 当前论文记忆**:对话自动注入「当前论文」上下文;**per-session 独立指针**,
  多对话并行各看各的论文、各归各的笔记
- **🔒 预设门控**:工具与 UI 仅对 `allowedPresets` 配置的预设开放
- **🤖 模型工具集**:`paper_switch` / `paper_capture` / `paper_read_figure` /
  `paper_attach_pdf` / `paper_glossary` / `paper_qa` / `paper_summary` / `paper_find`

设计文档见 [DESIGN.md](DESIGN.md)。

## 安装

### 方式一:预构建包(推荐)

下载 `dsh-external-dsh-paper-reading-<version>.tgz`(仓库 `dist/` 目录或 Releases):

```bash
cd ~/.dsh/profiles/web
npm i /path/to/dsh-external-dsh-paper-reading-<version>.tgz
# 重启 DeepSeek Harness
```

### 方式二:源码构建

```bash
git clone https://github.com/mrk-king/dsh-paper-reading.git
cd dsh-paper-reading
npm run build        # host 编译(tsc)+ client bundle(tsdown)
npm pack             # 产出 tgz(含 lib/ 与 assets/)
```

## 使用

1. 安装 **dsh-preset-literature** 预设,用「📚 文献精读 · Router Paper」新建会话
2. 右下角「📄 论文」按钮打开论文窗口
3. 把 PDF 拖进窗口(或页面任意位置)→ 自动入库(标题=文件名),在线阅读
4. 对话中粘贴文字/提问 → 自动归档问答与术语;窗口切换论文后记忆自动跟随
5. 也可以直接用对话:**粘贴文字/图片发给 AI,模型按提示词自动清洗归档**

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `libraryRoot` | `~/Documents/papers-library` | 论文库根目录 |
| `modlensBin` | 自动探测 | ModLens 视觉引擎(读图 OCR,可选) |
| `allowedPresets` | `["channel-router"]` | 允许论文功能的预设 id 列表 |
| `chatPush` | `true` | 面板内容可推送到对话 |
| `promptSection` | `true` | 注入论文阅读行为提示词段 |

```yaml
# profile 层配置示例
- id: paper-reading
  name: '@dsh-external/dsh-paper-reading'
  config:
    allowedPresets: ['channel-router']
    chatPush: true
```

## 数据位置

默认论文库:`~/Documents/papers-library/`(每篇论文一个目录:
`paper.pdf` / `paper.txt` / `notes.md` / `glossary.md` / `figures.md` / `figures/`;
删除论文先进回收站 `trash/`,30 天自动清除)。

## 构建产物说明

- `lib/` — 编译后的 host 插件 + client 模块
- `assets/pdfjs/` `assets/pdfjs-legacy/` — 自托管 Mozilla pdf.js viewer
  (Apache-2.0,见各目录 LICENSE)
- 运行时仅依赖 Node 内建(node 20+);视觉能力可选(ModLens)

## License

MIT(内置 pdf.js 资源为 Apache-2.0,见 `assets/pdfjs/LICENSE`)
