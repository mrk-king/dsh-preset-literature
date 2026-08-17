# dsh-paper-reading 插件设计文档

> 论文阅读伴侣:阅读文献时,把复制下来的**文字**或**图片**交给 harness 解答、
> 整理并归档。适用场景:你在浏览器/PDF 阅读器里读论文,harness GUI 就在旁边。

## 1. 目标与工作流

```
读论文时 ──► 选中一段文字 Ctrl+C ──► 粘贴到「论文阅读」面板(或直接发到对话)
              │                        │
              ▼                        ▼
        面板:🧹收藏整理          对话:模型调用 paper_capture
        面板:❓提问解释    ──►  清洗排版(去页码/连字符/断行)
        面板:🖼️解读图片   ──►  ModLens OCR → 转录归档
                                      │
                                      ▼
                              论文库 ~/Documents/papers-library/
                              papers/<id>/{notes.md, figures.md, glossary.md}
```

三种入口殊途同归:
1. **直接粘贴到对话**(原有路径):模型按系统提示词先 `paper_capture` 清洗归档,
   再回答;图片路径走 `paper_read_figure`。
2. **粘贴即弹窗**:在对话输入框内粘贴文字/图片(capture 阶段监听
   `[data-input-scroll]`/`[data-composer-card]` 命中)→ 页面**右侧自动弹出
   论文窗口**,显示输入框内容预览 + 当前论文笔记,提供「📥 归档」「❓ 归档并
   提问」;图片粘贴由 modlens 接管路径,窗口同步弹出展示图表归档。
   窗口关闭后可通过右下角悬浮「📄 论文」按钮随时重开。
3. **面板「提问解释」**:面板把文字 POST 给后端 → 后端清洗归档 →
   作为用户消息推给当前对话(agent.followup)→ 模型回答。
3. **面板「解读图片」**:选择/粘贴图片 → 后端存图 + ModLens OCR →
   转录归档 → 推送对话让模型解读。

## 2. 组成

| 层 | 文件 | 职责 |
|---|---|---|
| Host | `src/index.ts` | 插件入口:7 个模型工具、系统提示词段落、REST API、对话推送 |
| Host | `src/library.ts` | 论文库持久化:index.json + 每篇论文的 markdown 笔记 |
| Host | `src/normalize.ts` | 粘贴文本清洗(纯函数,无依赖) |
| Host | `src/vision.ts` | ModLens CLI 桥接(子进程 + 超时 + 取消) |
| Client | `src/client/index.ts` | GUI 面板(conversation.view slot,原生 DOM,零框架) |

## 3. 模型工具集(7 个,raw JSON-Schema 注册)

| 工具 | 用途 |
|---|---|
| `paper_switch` | 选择/创建"当前论文" |
| `paper_capture` | 清洗 + 归档粘贴文本(去重,返回清洗结果) |
| `paper_read_figure` | ModLens 读图 → OCR/摘要转录归档(存图副本) |
| `paper_glossary` | 术语表 list/add |
| `paper_qa` | 归档问答对(回答完有价值的问题后调用) |
| `paper_summary` | 回顾:current / today / all 三档 |
| `paper_find` | 全库关键词检索 |

注册方式参考 modlens 插件:raw JSON-Schema + `ctx.tools.register`,不依赖
`dsh-tools` 运行时解析(树外插件最稳路径,已在 modlens 实战验证)。

## 4. 关键机制

### 4.1 系统提示词段落(systemPrompt.section)
`order: 200` 注入「论文阅读模式」:要求模型粘贴文字先 `paper_capture`、
图片用 `paper_read_figure`、忠于原文、公式 LaTeX、不确定标注、问答归档。

### 4.2 面板 → 对话推送(panel → chat)
- 监听 `session/event` 的 `user/message`(且 `source.kind === 'user'`),
  记录最近活跃会话 id。
- 推送:构造 `createUserMessage({source:{kind:'user'}, content:[{type:'text'}]})`
  调 `agent.followup()`(next-turn + wakeup,空闲/忙碌均安全入队)。
- 无活跃会话时返回 `chatPushed:false`,面板提示"先在对话区发一条消息"。

### 4.3 视觉(ModLens 复用,不重复造轮子)
- 解析顺序:`config.modlensBin` → `$MODLENS_BIN` →
  `~/.dsh/profiles/web/node_modules/@liustack/modlens/dist/main.js`。
- 调用:`node <bin> -i <path> --timeout 180000 [--prompt ...]`,JSON stdout
  取 `result`(与内置 `modlens_read_image` 同构)。
- 面板上传的 base64 图片:魔数嗅探扩展名 → 临时文件 → OCR →
  复制进 `papers/<id>/figures/` 归档 → 删除临时文件。

### 4.4 清洗算法(normalize.ts)
1. 丢弃:页码 / "Page X of Y" / arXiv 号 / DOI / 重复页眉页脚(≥3 次)。
2. 连字符断词:行尾 `word-` + 下行小写开头 → 粘合。
3. 软断行:上行不以句末标点结尾且下行小写开头 → 空格拼接(双向)。
4. 数学行(含 `$`、`\begin`、`\label` 等)不参与拼接。
5. 折叠多余空行与空格。

### 4.5 论文库布局
```
papers-library/
  index.json            # { current, papers:[{id,title,createdAt,updatedAt}] }
  papers/<id>/
    meta.json           # 含 captures 哈希表(去重,上限 1000)
    notes.md            # ## 📌 片段 / ## 💬 Q&A(时间戳 + 可选标签)
    figures.md          # ## 🖼️ 图表转录(摘要 + OCR 全文)
    glossary.md         # - **术语** — 解释
    figures/            # 图片副本
```

## 5. REST API(面板后端)

| 端点 | 方法 | 说明 |
|---|---|---|
| `/dsh-paper-reading/api/status` | GET | 当前论文/列表/视觉可用性/对话推送可用性 |
| `/dsh-paper-reading/api/switch` | POST | `{title}` 切换或新建论文 |
| `/dsh-paper-reading/api/capture` | POST | `{text, label?, ask?, question?}` 清洗归档(+可选推送) |
| `/dsh-paper-reading/api/read-image` | POST | `{data(base64), ext?, title?, question?, ask?}` OCR 归档(+可选推送) |
| `/dsh-paper-reading/api/notes` | GET | 当前论文 notes/figures/glossary 尾部 |
| `/dsh-paper-reading/api/glossary` | POST | `{action:'list'|'add', term?, explanation?}` |
| `/dsh-paper-reading/api/ask` | POST | `{text}` 推送任意用户消息到对话 |

## 6. 配置(Config schema)

| 键 | 默认 | 说明 |
|---|---|---|
| `libraryRoot` | `~/Documents/papers-library` | 论文库根目录 |
| `modlensBin` | `''`(自动探测) | ModLens CLI 路径 |
| `maxCaptureChars` | 30000 | 单条归档/推送字符上限 |
| `chatPush` | true | 是否允许面板推送消息到对话 |
| `promptSection` | true | 是否注入系统提示词段落 |

## 7. 构建与装配

- 构建:tsc 编译 host(tsc)+ tsdown 双 bundle(host 自包含 ESM、
  client `ModuleLoader.load` 包裹),产物 `lib/{index,client}.js`。
- host bundle 内联 schemastery/dsh-llm 等全部依赖,运行时零裸依赖
  (仅 `node:` 内建),规避注入器 node_modules 解析不稳问题。
- 注入:`dev_inject_plugin`(免重启)→ 浏览器刷新加载 client。
- 卸载:`dev_uninject_plugin`。

## 8. 设计取舍

- **不抢模型的活**:解释/翻译/总结是模型能力,工具只做"清洗、归档、检索、
  读图"这些模型做不了或不该做的 I/O 与文本工程。
- **不重复视觉轮子**:图片理解完全复用 ModLens(本机已装),插件只负责
  把转录结果归档进论文库并组织问答上下文。
- **面板零框架**:原生 DOM,与 experiment-lab 面板同款模式,避免 React
  依赖与 slot 类型系统耦合。
- **去重**:哈希表防止同一段反复归档;重复时仍返回清洗文本供模型回答。
- **保守清洗**:只做可逆性高的排版修复,绝不重写内容;数学行不动。
