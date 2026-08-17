/**
 * @dsh-external/dsh-paper-reading — 论文阅读伴侣 (host).
 *
 * 阅读文献时,把复制下来的文字或图片交给 harness:本插件提供
 *  1. 模型工具集 (paper_*): 归档/清洗/读图/术语/问答/检索/回顾,
 *  2. Web 面板 API (conversation.view 面板的 REST 后端),
 *  3. 面板「发送到对话」通道: 把捕获内容作为用户消息推给当前 GUI agent。
 *
 * 视觉能力复用本机已装的 ModLens (~/.modlens/config.json + web profile 的
 * @liustack/modlens CLI);论文库默认落在 ~/Documents/papers-library。
 */
import type { Context } from 'cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { execFileSync } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join, resolve, sep, extname } from 'node:path'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import z from 'schemastery'
import * as lib from './library.js'
import { normalizePastedText } from './normalize.js'
import { readImage, renderEvidence, resolveModlensBin, type VisionEvidence } from './vision.js'

export const name = '@dsh-external/dsh-paper-reading'

export const inject = ['tools', 'agents']

export interface Config {
  libraryRoot: string
  modlensBin: string
  maxCaptureChars: number
  chatPush: boolean
  promptSection: boolean
  allowedPresets: string[]
}

export const Config = z.object({
  libraryRoot: z.string().default(join(homedir(), 'Documents', 'papers-library')),
  modlensBin: z.string().default(''),
  maxCaptureChars: z.number().min(1000).max(200000).default(30000),
  chatPush: z.boolean().default(true),
  promptSection: z.boolean().default(true),
  allowedPresets: z.array(z.string()).default(['channel-router']),
})

type AppContext = Context & {
  tools: {
    register(def: Record<string, unknown>): unknown
  }
  agents: {
    get(id: string): { followup(message: unknown): void } | undefined
  }
}

interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: { schema: Record<string, unknown>; render: (args: any, value: any) => Array<{ type: 'text'; text: string }> }
  timeoutMs?: number
  isConcurrencySafe?: () => boolean
  execute: (args: any, exec: { signal: AbortSignal }) => Promise<unknown>
}

export function apply(ctx: AppContext, config: Config): void {
  const root = config.libraryRoot
  mkdirSync(join(root, 'papers'), { recursive: true })
  try { lib.purgeTrash(root) } catch { /* ignore */ }
  ctx.logger?.info?.(`[paper-reading] library=${root}`)

  let modlensBin = resolveModlensBin(config.modlensBin)
  ctx.logger?.info?.(`[paper-reading] vision=${modlensBin ? 'modlens@' + modlensBin : 'unavailable'}`)

  // ── active GUI session tracking (for panel → chat push) ────────────────
  let lastActiveSession: string | null = null
  ;(ctx as any).on('session/event', (session: { id: string }, event: { type?: string; data?: { source?: { kind?: string } } }) => {
    if (event?.type === 'user/message' && event.data?.source?.kind === 'user') {
      lastActiveSession = session.id
    }
    // agent-preset/selected 是持久化事件,一定从全局 session/event 流过
    // (agent-presets 插件的重新 emit 是局部作用域,收不到,必须在这里取)
    if (event?.type === 'agent-preset/selected') {
      lastActiveSession = session.id
      const p = (event as any).data?.agentPreset
      if (typeof p === 'string') sessionPresets.set(session.id, p)
    }
  })

  function pushToChat(text: string): boolean {
    if (!config.chatPush) return false
    if (!lastActiveSession) return false
    const agent = ctx.agents.get(lastActiveSession)
    if (!agent) return false
    try {
      agent.followup(createUserMessage({
        source: { kind: 'user' },
        content: [{ type: 'text', text: text.slice(0, config.maxCaptureChars) }],
      }))
      return true
    } catch {
      return false
    }
  }

  // ── per-session current paper(多对话并行:各会话独立追踪当前论文)──
  const sessionCurrents = new Map<string, string>()
  /** 解析某会话的当前论文:会话有独立指针用会话的,否则回退全局。 */
  function currentPaperFor(sid?: string | null): lib.PaperSummary | null {
    if (sid && sessionCurrents.has(sid)) {
      const pid = sessionCurrents.get(sid) as string
      const p = lib.listPapers(root).papers.find(x => x.id === pid)
      if (p) return p
    }
    return lib.currentPaper(root)
  }

  function requireCurrentPaperFor(exec: any): { paper: lib.PaperSummary } {
    const sid = exec?.agent?.session?.id
    let paper = currentPaperFor(sid)
    if (!paper) {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const title = `未命名论文 ${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
      paper = lib.switchPaper(root, title).paper
      if (sid) sessionCurrents.set(sid, paper.id)
    }
    return { paper }
  }

  /** 面板/路由侧:按最近活跃会话解析当前论文。 */
  function requireRoutePaper(): { paper: lib.PaperSummary } {
    return requireCurrentPaperFor({ agent: { session: { id: lastActiveSession } } })
  }

  /** 从请求 URL 解析 sid 查询参数。 */
  function sidFrom(req: any): string | null {
    try {
      const q = String(req?.url ?? '').split('?')[1] ?? ''
      return new URLSearchParams(q).get('sid')
    } catch {
      return null
    }
  }

  /**
   * 从粘贴文本中识别其所属论文:若文本包含库中某篇(非当前)论文的完整标题,
   * 返回该论文(多个命中或标题过短返回 null 表示不自动切换)。
   */
  function detectPaperFromText(text: string, sid?: string | null): lib.PaperSummary | null {
    const { papers } = lib.listPapers(root)
    const cur = currentPaperFor(sid)
    const t = text.toLowerCase()
    let hit: lib.PaperSummary | null = null
    for (const p of papers) {
      if (cur && p.id === cur.id) continue
      // 候选标题:完整标题 + 剥离尾部括号注释(如 " (MAE)")的标题
      const full = p.title.toLowerCase().trim()
      const stripped = full.replace(/\s*\([^)]*\)\s*$/, '').trim()
      const candidates = [...new Set([full, stripped].filter(x => x.length >= 8))]
      if (candidates.some(c => t.includes(c))) {
        if (hit) return null // 多个命中 → 不自动切换,交给模型询问
        hit = p
      }
    }
    return hit
  }

  function pdfMetaOf(id: string): { title: string; pages: number; bytes: number } | null {
    const m = lib.pdfMetaOf(root, id)
    return m ? { title: m.title, pages: m.pages, bytes: m.bytes } : null
  }

  // ── model-facing tools (raw JSON-Schema registration, modlens-proven) ──
  const tools: ToolDef[] = [
    {
      name: 'paper_switch',
      description:
        'Select or create the "current paper" of the reading library. With no title, returns the current paper and the paper list. Call this before paper_capture/paper_read_figure when the user starts reading a new paper or switches papers.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Paper title to switch to (creates it when missing).' },
        },
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            current: { oneOf: [{ type: 'object' }, { type: 'null' }] },
            papers: { type: 'array' },
            created: { type: 'boolean' },
          },
          required: ['current', 'papers', 'created'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: formatSwitch(value) }],
      },
      async execute(args, exec: any) {
        const sid = exec?.agent?.session?.id
        if (!args?.title || String(args.title).trim() === '') {
          const current = currentPaperFor(sid)
          return { current, papers: lib.listPapers(root).papers, created: false }
        }
        const { paper, created } = lib.switchPaper(root, String(args.title).trim())
        if (sid) sessionCurrents.set(sid, paper.id)
        return { current: paper, papers: lib.listPapers(root).papers, created }
      },
    },
    {
      name: 'paper_capture',
      description:
        'Archive a snippet of pasted paper text into the current paper\'s notes. Cleans up messy PDF copy (page numbers, hyphenation, soft line breaks) unless raw=true, dedupes repeats, and returns the normalized text. Use whenever the user pastes literature text and asks you to explain, summarize or translate it.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Raw pasted text (may contain PDF artifacts).' },
          label: { type: 'string', description: 'Optional short label for the snippet, e.g. "Abstract", "Sec 3.2", "Eq. (7)".' },
          raw: { type: 'boolean', description: 'Skip normalization and store verbatim.' },
        },
        required: ['text'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            normalized: { type: 'string' },
            duplicate: { type: 'boolean' },
            paper: { type: 'object' },
            savedPath: { type: 'string' },
            droppedLines: { type: 'number' },
            switchedTo: { type: 'string' },
          },
          required: ['normalized', 'duplicate', 'paper', 'savedPath', 'droppedLines'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: formatCapture(value) }],
      },
      async execute(args, exec: any) {
        const raw = String(args?.text ?? '')
        if (raw.trim() === '') throw new Error('paper_capture needs non-empty text')
        let { paper } = requireCurrentPaperFor(exec)
        const sid = exec?.agent?.session?.id
        // 内容自动识别:粘贴文本含另一篇论文标题 → 自动切换当前论文
        const detected = detectPaperFromText(raw, sid)
        let switchedTo: string | undefined
        if (detected && detected.id !== paper.id) {
          paper = detected
          if (sid) sessionCurrents.set(sid, detected.id)
          switchedTo = detected.title
        }
        const norm = args?.raw === true
          ? { text: raw, droppedLines: 0, joinedHyphens: 0, joinedLines: 0 }
          : normalizePastedText(raw)
        const text = norm.text.slice(0, config.maxCaptureChars)
        const hash = lib.captureHash(text)
        const duplicate = lib.isDuplicate(root, paper.id, hash)
        // 返回对象不能带 undefined 字段(JSON 序列化丢键 → harness lossless-JSON 校验失败):
        // 仅当真的发生论文切换时才带 switchedTo 键,否则整个省略(输出 schema 中该字段非必填)
        const base = {
          normalized: text,
          duplicate: false,
          paper,
          savedPath: '',
          droppedLines: norm.droppedLines,
        }
        if (!duplicate) {
          const stamp = lib.nowStamp()
          const label = args?.label ? ` [${String(args.label).trim()}]` : ''
          const block = `## 📌 片段 [${stamp}]${label}\n\n${text}`
          base.savedPath = lib.appendNote(root, paper.id, block)
          lib.rememberCapture(root, paper.id, hash, args?.label)
        } else {
          base.duplicate = true
        }
        return { ...base, ...(switchedTo ? { switchedTo } : {}) }
      },
    },
    {
      name: 'paper_read_figure',
      description:
        'Read an image (figure, table screenshot, formula, or a page scan of the paper) through the modlens vision bridge, archive the transcript into the current paper\'s figures log, and return the OCR/evidence text. Use whenever the user gives you an image file path or URL related to the paper and asks you to explain it. Requires a configured modlens engine.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute local image path or http(s) URL.' },
          title: { type: 'string', description: 'Optional figure title, e.g. "Fig. 2 (architecture)".' },
          question: { type: 'string', description: 'Optional extra focus for the vision read.' },
        },
        required: ['path'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            transcript: { type: 'string' },
            figurePath: { type: 'string' },
            paper: { type: 'object' },
            vision: { type: 'boolean' },
          },
          required: ['transcript', 'figurePath', 'paper', 'vision'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: formatFigure(value) }],
      },
      timeoutMs: 220_000,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const path = String(args?.path ?? '').trim()
        if (!path) throw new Error('paper_read_figure needs a non-empty "path"')
        if (!modlensBin) throw new Error('vision engine unavailable: no modlens binary found (set config.modlensBin or $MODLENS_BIN)')
        const { paper } = requireCurrentPaperFor(exec)
        const title = args?.title ? String(args.title).trim() : '未命名图'
        const evidence = await readImage(modlensBin, path, {
          prompt: args?.question ? String(args.question) : undefined,
          signal: exec.signal,
        })
        const transcript = renderEvidence(evidence)
        // archive a copy of the image into the paper's figures/ dir when local
        let figurePath = ''
        if (!/^https?:\/\//i.test(path) && existsSync(path)) {
          try {
            const ext = extOf(path)
            const dir = join(lib.paperDir(root, paper.id), 'figures')
            mkdirSync(dir, { recursive: true })
            const { copyFileSync } = await import('node:fs')
            figurePath = join(dir, `fig-${Date.now()}${ext}`)
            copyFileSync(path, figurePath)
          } catch { /* keep figurePath empty on copy failure */ }
        }
        const stamp = lib.nowStamp()
        const block = [
          `## 🖼️ ${title} [${stamp}]`,
          figurePath ? `- 文件: ${figurePath}` : `- 源: ${path}`,
          `- 摘要: ${evidence.summary ?? '(无)'}`,
          '',
          transcript,
        ].join('\n')
        lib.appendFigure(root, paper.id, block)
        return { transcript, figurePath, paper, vision: true }
      },
    },
    {
      name: 'paper_attach_pdf',
      description:
        'Attach the PDF file the user dropped into the conversation to the paper with the given title: copies it into the paper\'s folder, extracts metadata (title/pages) and full text, and returns the extracted text preview. If a paper with that title already exists it attaches there; otherwise a new paper is created. Use it whenever the user drags a PDF into the chat or gives you a PDF file path, BEFORE explaining its content. TITLE IS REQUIRED: if the user did not supply a paper title, first ASK them for the paper name, then attach. The paper is placed in the default folder.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Absolute path of the PDF file (as received from the attachment).' },
          title: { type: 'string', description: 'Paper title (REQUIRED — ask the user if not given; overrides pdfinfo/file name).' },
        },
        required: ['path', 'title'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            paper: { type: 'object' },
            pdfPath: { type: 'string' },
            title: { type: 'string' },
            pages: { type: 'number' },
            bytes: { type: 'number' },
            textPreview: { type: 'string' },
            created: { type: 'boolean' },
          },
          required: ['paper', 'pdfPath', 'title', 'pages', 'bytes', 'textPreview'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: formatPdf(value) }],
      },
      timeoutMs: 90_000,
      isConcurrencySafe: () => true,
      async execute(args, exec) {
        const src = String(args?.path ?? '').trim()
        if (!src) throw new Error('paper_attach_pdf needs a non-empty "path"')
        if (!/\.pdf$/i.test(src)) throw new Error('paper_attach_pdf expects a .pdf file')
        if (!existsSync(src)) throw new Error(`PDF not found: ${src}`)
        if (exec.signal.aborted) throw new Error('aborted')
        const wanted = String(args?.title ?? '').trim()
        const { paper, created } = resolveAttachTarget(root, wanted, src)
        const meta = lib.attachPdf(root, paper.id, src, args?.title)
        const textPreview = lib.pdfTextOf(root, paper.id, 8000)
        return {
          paper,
          pdfPath: meta.pdfPath,
          title: meta.title,
          pages: meta.pages,
          bytes: meta.bytes,
          textPreview,
        }
      },
    },
    {
      name: 'paper_glossary',
      description:
        'List or extend the current paper\'s glossary. Use action=list to refresh terminology; action=add saves a term you already explained (e.g. after answering the user) so later reads reuse it.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add'], description: 'list (default) or add.' },
          term: { type: 'string', description: 'Term to add (required for add).' },
          explanation: { type: 'string', description: 'One-line explanation (required for add).' },
        },
        required: ['action'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            entries: { type: 'array', items: { type: 'object' } },
            added: { type: 'boolean' },
            paper: { type: 'object' },
          },
          required: ['entries', 'added', 'paper'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: formatGlossary(value) }],
      },
      async execute(args, exec: any) {
        const { paper } = requireCurrentPaperFor(exec)
        if (args?.action === 'add') {
          const term = String(args.term ?? '').trim()
          const explanation = String(args.explanation ?? '').trim()
          if (!term || !explanation) throw new Error('paper_glossary add needs both "term" and "explanation"')
          lib.appendGlossary(root, paper.id, term, explanation)
          return { entries: lib.listGlossary(root, paper.id), added: true, paper }
        }
        return { entries: lib.listGlossary(root, paper.id), added: false, paper }
      },
    },
    {
      name: 'paper_qa',
      description:
        'Record a Q&A pair into the current paper\'s notes. Call this after you answered a substantive question about the paper, so the knowledge is archived for later reading sessions.',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The user\'s question (or your recap of it).' },
          answer: { type: 'string', description: 'Your answer, concise.' },
          section: { type: 'string', description: 'Optional section reference, e.g. "Sec 4.1".' },
        },
        required: ['question', 'answer'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            saved: { type: 'boolean' },
            paper: { type: 'object' },
          },
          required: ['saved', 'paper'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: value.saved ? `已记录到论文《${value.paper.title}》。` : '未记录。' }],
      },
      async execute(args, exec: any) {
        const q = String(args?.question ?? '').trim()
        const a = String(args?.answer ?? '').trim()
        if (!q || !a) throw new Error('paper_qa needs both "question" and "answer"')
        const { paper } = requireCurrentPaperFor(exec)
        const stamp = lib.nowStamp()
        const section = args?.section ? ` [${String(args.section).trim()}]` : ''
        const block = `## 💬 Q&A [${stamp}]${section}\n\n**Q:** ${q}\n\n**A:** ${a}`
        lib.appendNote(root, paper.id, block)
        return { saved: true, paper }
      },
    },
    {
      name: 'paper_summary',
      description:
        'Read back what is archived in the library: the current paper\'s notes/glossary/figures (scope=current, default), today\'s snippets across all papers (scope=today), or every paper\'s latest notes (scope=all). Use it to answer "what have I read", write reading reports, or refresh context at the start of a long answer.',
      parameters: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['current', 'today', 'all'], description: 'Which slice to read back.' },
          maxChars: { type: 'number', description: 'Cap total characters (default 12000).' },
        },
        required: ['scope'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            paper: { oneOf: [{ type: 'object' }, { type: 'null' }] },
          },
          required: ['text', 'paper'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: value.text }],
      },
      async execute(args, exec: any) {
        const maxChars = Math.min(Number(args?.maxChars ?? 12000) || 12000, 60000)
        const scope = args?.scope === 'today' || args?.scope === 'all' ? args.scope : 'current'
        if (scope === 'current') {
          const paper = currentPaperFor(exec?.agent?.session?.id)
          if (!paper) return { text: '（论文库为空——先用 paper_switch 选择或创建一篇论文。）', paper: null }
          const { notes, figures } = lib.readPaperNotes(root, paper.id)
          const glossary = lib.readGlossary(root, paper.id)
          const figs = lib.figureCount(root, paper.id)
          const parts = [
            `# 论文: ${paper.title}`,
            `片段/问答笔记(${notes.length} 字符):`,
            notes || '（无）',
            `图表转录(${figs} 张):`,
            figures || '（无）',
            '术语表:',
            glossary || '（无）',
          ]
          return { text: parts.join('\n\n').slice(0, maxChars), paper }
        }
        if (scope === 'today') {
          const today = new Date().toISOString().slice(0, 10)
          const entries = lib.todaysEntries(root, today)
          if (entries.length === 0) return { text: '（今天还没有归档任何片段。）', paper: null }
          const text = `# 今日阅读 (${today})\n\n${entries.map(e => `## ${e.title}\n\n${e.entry}`).join('\n\n')}`
          return { text: text.slice(0, maxChars), paper: null }
        }
        const { papers } = lib.listPapers(root)
        if (papers.length === 0) return { text: '（论文库为空。）', paper: null }
        const parts: string[] = ['# 论文库总览']
        for (const p of papers.slice(0, 12)) {
          const { notes } = lib.readPaperNotes(root, p.id)
          parts.push(`## ${p.title} (更新于 ${p.updatedAt.slice(0, 10)})\n${(notes || '（无笔记）').slice(0, 3000)}`)
        }
        return { text: parts.join('\n\n').slice(0, maxChars), paper: null }
      },
    },
    {
      name: 'paper_find',
      description:
        'Search every archived note in the library for a keyword/phrase and return matching lines with the paper title. Use for literature review ("where did I write about X?") instead of manual grepping.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search phrase.' },
          maxResults: { type: 'number', description: 'Cap matches (default 12).' },
        },
        required: ['query'],
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            matches: { type: 'array', items: { type: 'object' } },
          },
          required: ['matches'],
          additionalProperties: false,
        },
        render: (_args, value) => [{ type: 'text', text: formatFind(value) }],
      },
      async execute(args) {
        const q = String(args?.query ?? '').trim()
        if (!q) throw new Error('paper_find needs a non-empty "query"')
        const matches = lib.findInLibrary(root, q, Math.min(Number(args?.maxResults ?? 12) || 12, 50))
        return { matches }
      },
    },
  ]
  for (const tool of tools) {
    try {
      // 单点门控:任何 paper_* 工具都先校验会话预设
      const wrapped = {
        ...tool,
        execute: async (args: any, exec: any) => {
          assertPaperAllowed(exec)
          return (tool as any).execute(args, exec)
        },
      }
      ctx.tools.register(wrapped as unknown as Record<string, unknown>)
    } catch (e) {
      ctx.logger?.warn?.(`[paper-reading] tool ${tool.name} registration skipped: ${String(e)}`)
    }
  }

  // ── 预设门控:论文功能仅限指定预设 ─────────────────────────────────────
  const sessionPresets = new Map<string, string>()
  function presetOf(sid?: string | null): string | undefined {
    return sid ? sessionPresets.get(sid) : undefined
  }
  function assertPaperAllowed(exec: any): void {
    const sid = exec?.agent?.session?.id
    const preset = presetOf(sid)
    if (preset !== undefined && !config.allowedPresets.includes(preset)) {
      throw new Error(
        `论文功能仅在「${config.allowedPresets.join(' / ')}」预设下可用。`
        + '请切换到该预设,或进入该预设的历史会话。',
      )
    }
  }

  // ── system prompt section: paper-reading behaviour(按预设门控)────────
  if (typeof ctx.on === 'function') {
    if (config.promptSection) {
      ;(ctx as any).on('system-prompt/assemble', async (_assembly: any, context: any, next: any) => {
        const assembled = await next()
        const agent = context?.agent
        const sid = agent?.session?.id
        if (!sid) return assembled
        // 正在组装的会话即活跃会话:预热论文 UI 门控
        lastActiveSession = sid
        // agent-preset/selected 是持久化事件且可能多次切换:取「最后一次」选择
        const sels = agent.session.events?.filter?.((e: any) => e.type === 'agent-preset/selected')
        const sel = sels?.[sels.length - 1]
        if (sel?.data?.agentPreset) sessionPresets.set(sid, sel.data.agentPreset)
        const preset = presetOf(sid)
        if (preset !== undefined && !config.allowedPresets.includes(preset)) return assembled
        const sections = [...(assembled.sections ?? [])]
        sections.push({ name: 'paper-reading', order: 200, text: PAPER_SECTION_TEXT })
        // 当前论文动态上下文:随论文窗口/工具切换自动更新,让对话始终"基于当前论文"
        try {
          const cur = currentPaperFor(sid)
          let folderLabel = '未分类'
          if (cur && Array.isArray(cur.folders) && cur.folders.length > 0) {
            const f = lib.listFolders(root).find(x => x.id === (cur.folders as string[])[0])
            if (f) folderLabel = f.name
          }
          sections.push({
            name: 'paper-current',
            order: 210,
            text: cur
              ? `## 当前论文\n当前论文:《${cur.title}》(文件夹:${folderLabel})。用户说"这篇论文/当前论文/它"时均指它;需要细节或归档时使用 paper_summary(scope=current)、paper_find、paper_capture、paper_qa、paper_glossary——这些工具都作用于当前论文。切换论文后本段自动更新。`
              : '## 当前论文\n当前未选择论文。用户给出 PDF 时,先按 paper_attach_pdf 流程询问论文名后归档。',
          })
        } catch { /* ignore */ }
        return { ...assembled, sections }
      })
    }
  }

  // ── web panel API ──────────────────────────────────────────────────────
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope: any) => {
      // PDF 文档请求计数(诊断 pdf.js viewer 是否发起了文件拉取)
      let pdfRequestCount = 0
      const routes: Array<{ name: string; kind?: 'exact' | 'prefix'; path: string; handler: (req: any, res: any) => Promise<void> }> = [
        {
          name: 'paper-reading-gate',
          path: '/dsh-paper-reading/api/gate',
          handler: async (req, res) => {
            // 优先用客户端上报的当前查看会话;否则回退到最近活跃会话
            const q = String(req?.url ?? '').split('?')[1] ?? ''
            let sid: string | null = null
            try { sid = new URLSearchParams(q).get('sid') } catch { /* ignore */ }
            if (!sid) sid = lastActiveSession
            let preset = sid ? sessionPresets.get(sid) : undefined
            // 兜底:从磁盘会话日志直读预设(取最后一次选择;命中后缓存进 map)
            if (!preset && sid) {
              const p = presetFromDisk(sid)
              if (p) {
                preset = p
                sessionPresets.set(sid, p)
              }
            }
            const allowed = preset !== undefined && config.allowedPresets.includes(preset)
            json(res, { ok: true, allowed, preset: preset ?? null, session: sid })
          },
        },
        {
          name: 'paper-reading-status',
          path: '/dsh-paper-reading/api/status',
          handler: async (req, res) => {
            const { papers } = lib.listPapers(root)
            const current = currentPaperFor(sidFrom(req))
            let pdf: { title: string; pages: number; bytes: number } | null = null
            if (current) {
              const meta = pdfMetaOf(current.id)
              if (meta) pdf = meta
            }
            json(res, {
              ok: true,
              current,
              papers,
              folders: lib.listFolders(root),
              trash: lib.trashCount(root),
              libraryRoot: root,
              vision: Boolean(modlensBin),
              chatPush: config.chatPush && Boolean(lastActiveSession),
              pdf,
              pdfRequests: pdfRequestCount,
            })
          },
        },
        {
          name: 'paper-reading-switch',
          path: '/dsh-paper-reading/api/switch',
          handler: async (req, res) => {
            const body = await readBody(req)
            const title = String(body?.title ?? '').trim()
            if (!title) return json(res, { ok: false, error: 'title required' })
            const { paper, created } = lib.switchPaper(root, title)
            const sid = sidFrom(req)
            if (sid) sessionCurrents.set(sid, paper.id)
            json(res, { ok: true, paper, created, papers: lib.listPapers(root).papers })
          },
        },
        {
          name: 'paper-reading-capture',
          path: '/dsh-paper-reading/api/capture',
          handler: async (req, res) => {
            const body = await readBody(req)
            const raw = String(body?.text ?? '')
            if (raw.trim() === '') return json(res, { ok: false, error: 'text required' })
            let { paper } = requireRoutePaper()
            // 内容自动识别:粘贴文本含另一篇论文标题 → 自动切换
            const detected = detectPaperFromText(raw, lastActiveSession)
            let switchedTo: string | null = null
            if (detected && detected.id !== paper.id) {
              paper = detected
              if (lastActiveSession) sessionCurrents.set(lastActiveSession, detected.id)
              switchedTo = detected.title
            }
            const norm = normalizePastedText(raw)
            const text = norm.text.slice(0, config.maxCaptureChars)
            const hash = lib.captureHash(text)
            const duplicate = lib.isDuplicate(root, paper.id, hash)
            if (!duplicate) {
              const label = body?.label ? ` [${String(body.label).trim()}]` : ''
              lib.appendNote(root, paper.id, `## 📌 片段 [${lib.nowStamp()}]${label}\n\n${text}`)
              lib.rememberCapture(root, paper.id, hash, body?.label)
            }
            let chatPushed = false
            if (body?.ask === true) {
              const q = body?.question ? `\n\n用户问题: ${String(body.question).trim()}` : ''
              chatPushed = pushToChat(
                `📄 论文《${paper.title}》片段(已归档${duplicate ? ',内容重复' : ''}):\n\n${text}${q}\n\n请解释/回答这段内容。`,
              )
            }
            json(res, {
              ok: true,
              normalized: text,
              duplicate,
              paper,
              switchedTo,
              droppedLines: norm.droppedLines,
              chatPushed,
            })
          },
        },
        {
          name: 'paper-reading-read-image',
          path: '/dsh-paper-reading/api/read-image',
          handler: async (req, res) => {
            const body = await readBody(req)
            const data = String(body?.data ?? '')
            if (!data) return json(res, { ok: false, error: 'data required (base64 image)' })
            if (!modlensBin) return json(res, { ok: false, error: 'vision engine unavailable (no modlens binary)' })
            const { paper } = requireRoutePaper()
            let tmpFile: string | null = null
            try {
              tmpFile = saveBase64Image(data, body?.ext)
              const title = body?.title ? String(body.title).trim() : '面板图片'
              const evidence: VisionEvidence = await readImage(modlensBin, tmpFile, {
                prompt: body?.question ? String(body.question) : undefined,
              })
              const transcript = renderEvidence(evidence)
              const dir = join(lib.paperDir(root, paper.id), 'figures')
              mkdirSync(dir, { recursive: true })
              const figurePath = join(dir, `fig-${Date.now()}${extOf(tmpFile)}`)
              const { copyFileSync } = await import('node:fs')
              copyFileSync(tmpFile, figurePath)
              const block = [
                `## 🖼️ ${title} [${lib.nowStamp()}]`,
                `- 文件: ${figurePath}`,
                `- 摘要: ${evidence.summary ?? '(无)'}`,
                '',
                transcript,
              ].join('\n')
              lib.appendFigure(root, paper.id, block)
              let chatPushed = false
              if (body?.ask === true) {
                const q = body?.question ? `\n\n用户问题: ${String(body.question).trim()}` : '请解读这张图。'
                chatPushed = pushToChat(`🖼️ 论文《${paper.title}》图表(已归档,转录如下):\n\n${transcript}\n\n${q}`)
              }
              json(res, { ok: true, transcript, figurePath, paper, chatPushed })
            } finally {
              if (tmpFile) {
                try {
                  const { rmSync } = await import('node:fs')
                  rmSync(tmpFile, { force: true })
                } catch { /* ignore */ }
              }
            }
          },
        },
        {
          name: 'paper-reading-notes',
          path: '/dsh-paper-reading/api/notes',
          handler: async (req, res) => {
            const paper = currentPaperFor(sidFrom(req))
            if (!paper) return json(res, { ok: true, paper: null, notes: '', notesFull: '', figures: '', glossary: '' })
            const { notes, figures } = lib.readPaperNotes(root, paper.id)
            let notesFull = ''
            try { notesFull = readFileSync(join(lib.paperDir(root, paper.id), 'notes.md'), 'utf8') } catch { /* no file */ }
            json(res, {
              ok: true,
              paper,
              notes,
              notesFull,
              figures,
              glossary: lib.readGlossary(root, paper.id),
              figureCount: lib.figureCount(root, paper.id),
            })
          },
        },
        {
          name: 'paper-reading-save-notes',
          path: '/dsh-paper-reading/api/save-notes',
          handler: async (req, res) => {
            const body = await readBody(req)
            const paper = currentPaperFor(sidFrom(req))
            if (!paper) return json(res, { ok: false, error: 'no current paper' })
            const text = String(body?.text ?? '')
            writeFileSync(join(lib.paperDir(root, paper.id), 'notes.md'), text, 'utf8')
            lib.touchPaper(root, paper.id)
            json(res, { ok: true, paper, savedChars: text.length })
          },
        },
        {
          name: 'paper-reading-delete-paper',
          path: '/dsh-paper-reading/api/delete-paper',
          handler: async (req, res) => {
            const body = await readBody(req)
            const title = String(body?.title ?? '').trim()
            if (!title) return json(res, { ok: false, error: 'title required' })
            const { papers } = lib.listPapers(root)
            const target = papers.find(p => p.id === title || p.title.toLowerCase() === title.toLowerCase())
            if (!target) return json(res, { ok: false, error: 'paper not found' })
            lib.removePaper(root, target.id)
            const after = lib.listPapers(root)
            json(res, { ok: true, deleted: target.title, papers: after.papers, current: after.index.current, folders: after.index.folders })
          },
        },
        {
          name: 'paper-reading-rename-paper',
          path: '/dsh-paper-reading/api/rename-paper',
          handler: async (req, res) => {
            const body = await readBody(req)
            const title = String(body?.title ?? '').trim()
            const newTitle = String(body?.newTitle ?? '').trim()
            if (!title) return json(res, { ok: false, error: 'title required' })
            if (!newTitle) return json(res, { ok: false, error: 'newTitle required' })
            const { papers } = lib.listPapers(root)
            const target = papers.find(p => p.id === title || p.title.toLowerCase() === title.toLowerCase())
            if (!target) return json(res, { ok: false, error: 'paper not found' })
            try {
              lib.renamePaper(root, target.id, newTitle)
            } catch (e) {
              return json(res, { ok: false, error: e instanceof Error ? e.message : String(e) })
            }
            const after = lib.listPapers(root)
            json(res, { ok: true, paper: after.papers.find(p => p.id === target.id), papers: after.papers })
          },
        },
        {
          name: 'paper-reading-folder-create',
          path: '/dsh-paper-reading/api/folder-create',
          handler: async (req, res) => {
            const body = await readBody(req)
            const name = String(body?.name ?? '').trim()
            if (!name) return json(res, { ok: false, error: 'folder name required' })
            const folder = lib.createFolder(root, name)
            const after = lib.listPapers(root)
            json(res, { ok: true, folder, folders: after.index.folders, papers: after.papers })
          },
        },
        {
          name: 'paper-reading-folder-assign',
          path: '/dsh-paper-reading/api/folder-assign',
          handler: async (req, res) => {
            const body = await readBody(req)
            const title = String(body?.title ?? '').trim()
            if (!title) return json(res, { ok: false, error: 'title required' })
            const { papers } = lib.listPapers(root)
            const target = papers.find(p => p.id === title || p.title.toLowerCase() === title.toLowerCase())
            if (!target) return json(res, { ok: false, error: 'paper not found' })
            // 新格式:folders: string[](完整替换,空数组=未分类)
            if (Array.isArray(body?.folders)) {
              const ids = body.folders.map((f: any) => String(f)).filter((f: string) => f && f !== 'none')
              for (const fid of ids) {
                if (!lib.listFolders(root).some(f => f.id === fid)) {
                  return json(res, { ok: false, error: `unknown folder: ${fid}` })
                }
              }
              lib.setPaperFolders(root, target.id, ids)
            } else if (body?.folder !== undefined) {
              // 兼容旧格式:folder: id|null(单值替换)
              const fid = body.folder ? String(body.folder) : null
              if (fid && fid !== 'none' && !lib.listFolders(root).some(f => f.id === fid)) {
                return json(res, { ok: false, error: 'unknown folder' })
              }
              lib.setPaperFolders(root, target.id, fid && fid !== 'none' ? [fid] : [])
            } else {
              return json(res, { ok: false, error: 'folders or folder required' })
            }
            const after = lib.listPapers(root)
            json(res, { ok: true, papers: after.papers })
          },
        },
        {
          name: 'paper-reading-folder-rename',
          path: '/dsh-paper-reading/api/folder-rename',
          handler: async (req, res) => {
            const body = await readBody(req)
            const id = String(body?.id ?? '').trim()
            const newName = String(body?.newName ?? '').trim()
            if (!id) return json(res, { ok: false, error: 'folder id required' })
            if (!newName) return json(res, { ok: false, error: 'newName required' })
            try {
              lib.renameFolder(root, id, newName)
            } catch (e) {
              return json(res, { ok: false, error: e instanceof Error ? e.message : String(e) })
            }
            const after = lib.listPapers(root)
            json(res, { ok: true, folders: after.index.folders, papers: after.papers })
          },
        },
        {
          name: 'paper-reading-folder-delete',
          path: '/dsh-paper-reading/api/folder-delete',
          handler: async (req, res) => {
            const body = await readBody(req)
            const id = String(body?.id ?? '').trim()
            if (!id) return json(res, { ok: false, error: 'folder id required' })
            lib.removeFolder(root, id)
            const after = lib.listPapers(root)
            json(res, { ok: true, folders: after.index.folders, papers: after.papers })
          },
        },
        {
          name: 'paper-reading-glossary',
          path: '/dsh-paper-reading/api/glossary',
          handler: async (req, res) => {
            const body = await readBody(req)
            const { paper } = requireRoutePaper()
            if (body?.action === 'add') {
              const term = String(body?.term ?? '').trim()
              const explanation = String(body?.explanation ?? '').trim()
              if (!term || !explanation) return json(res, { ok: false, error: 'term and explanation required' })
              lib.appendGlossary(root, paper.id, term, explanation)
            }
            json(res, { ok: true, entries: lib.listGlossary(root, paper.id), paper })
          },
        },
        {
          name: 'paper-reading-ask',
          path: '/dsh-paper-reading/api/ask',
          handler: async (req, res) => {
            const body = await readBody(req)
            const text = String(body?.text ?? '').trim()
            if (!text) return json(res, { ok: false, error: 'text required' })
            const chatPushed = pushToChat(text)
            json(res, { ok: true, chatPushed })
          },
        },
        {
          name: 'paper-reading-attach-pdf',
          path: '/dsh-paper-reading/api/attach-pdf',
          handler: async (req, res) => {
            const body = await readBody(req)
            const data = String(body?.data ?? '')
            if (!data) return json(res, { ok: false, error: 'data required (base64 pdf)' })
            let tmpFile: string | null = null
            try {
              tmpFile = saveBase64File(data, '.pdf')
              if (!isPdfFile(tmpFile)) return json(res, { ok: false, error: 'payload is not a PDF (magic bytes %PDF)' })
              const { paper, created } = resolveAttachTarget(root, String(body?.title ?? '').trim(), tmpFile)
              const meta = lib.attachPdf(root, paper.id, tmpFile, body?.title)
              json(res, {
                ok: true,
                paper,
                created,
                pdfPath: meta.pdfPath,
                title: meta.title,
                pages: meta.pages,
                bytes: meta.bytes,
                textPreview: lib.pdfTextOf(root, paper.id, 4000),
              })
            } finally {
              if (tmpFile) {
                try {
                  const { rmSync } = await import('node:fs')
                  rmSync(tmpFile, { force: true })
                } catch { /* ignore */ }
              }
            }
          },
        },
        {
          name: 'paper-reading-paper-pdf',
          kind: 'prefix',
          path: '/dsh-paper-reading/api/paper-pdf',
          handler: async (req, res) => {
            pdfRequestCount += 1
            const id = pathIdOf(req)
            if (!id) return json(res, { ok: false, error: 'paper id required' })
            const pdf = lib.pdfPathOf(root, id)
            if (!pdf) return json(res, { ok: false, error: 'no PDF attached to this paper' })
            const buf = readFileSync(pdf)
            res.statusCode = 200
            res.setHeader('content-type', 'application/pdf')
            res.setHeader('content-disposition', 'inline; filename="paper.pdf"')
            res.setHeader('cache-control', 'no-cache')
            res.end(buf)
          },
        },
        {
          name: 'paper-reading-paper-text',
          kind: 'prefix',
          path: '/dsh-paper-reading/api/paper-text',
          handler: async (req, res) => {
            const id = pathIdOf(req)
            if (!id) return json(res, { ok: false, error: 'paper id required' })
            const text = lib.pdfTextOf(root, id, 60000)
            json(res, { ok: true, text })
          },
        },
      ]
      for (const r of routes) {
        scope.webServer.register({
          name: r.name,
          kind: r.kind ?? 'exact',
          path: r.path,
          handler: async (req: any, res: any) => {
            try {
              await r.handler(req, res)
            } catch (e) {
              json(res, { ok: false, error: String(e instanceof Error ? e.message : e) })
            }
          },
        })
      }

      // ── pdf.js viewer 静态资源(self-hosted Mozilla PDF viewer)──────
      // modern 与 legacy 两套构建(legacy 为官方推荐的生产自托管构建)
      for (const [name, prefix, rootDir] of [
        ['paper-reading-pdfjs-static', '/dsh-paper-reading/pdfjs', PDFJS_ROOT],
        ['paper-reading-pdfjs-legacy-static', '/dsh-paper-reading/pdfjs-legacy', PDFJS_LEGACY_ROOT],
      ] as const) {
        scope.webServer.register({
          name,
          kind: 'prefix',
          path: prefix,
          handler: staticFileHandler(rootDir, prefix),
        })
      }
      ctx.logger?.info?.('[paper-reading] web API + pdf.js viewer mounted')
    })
  }

  ctx.effect(() => () => {
    ctx.logger?.info?.('[paper-reading] disposed')
  }, 'paper-reading: dispose')
}

// ── helpers ───────────────────────────────────────────────────────────────

/**
 * 决定拖入 PDF 的归属论文(避免误挂到无关的"当前论文"):
 *  1) 指定了标题且已存在同名论文 → 挂到它;
 *  2) 当前论文存在且还没有 PDF → 填充它;
 *  3) 否则 → 用标题(或 PDF 元信息/文件名)新建一篇。
 */
function resolveAttachTarget(root: string, wanted: string, srcPath: string): { paper: any; created: boolean } {
  const { index, papers } = lib.listPapers(root)
  if (wanted) {
    const hit = papers.find(p => p.title.toLowerCase() === wanted.toLowerCase() || p.id === wanted)
    if (hit) return { paper: hit, created: false }
  }
  if (index.current) {
    const cur = papers.find(p => p.id === index.current)
    if (cur && !lib.pdfPathOf(root, cur.id)) return { paper: cur, created: false }
  }
  const title = wanted || lib.titleFromPdf(srcPath)
  return lib.switchPaper(root, title)
}

// ── helpers ───────────────────────────────────────────────────────────────

/** 自托管 pdf.js viewer 静态资源根目录(<plugin>/assets/pdfjs,来自官方 GitHub Release dist)。 */
const PDFJS_ROOT = fileURLToPath(new URL('../assets/pdfjs', import.meta.url))
const PDFJS_LEGACY_ROOT = fileURLToPath(new URL('../assets/pdfjs-legacy', import.meta.url))

/** 从磁盘会话日志解析会话的预设(取最后一次 agent-preset/selected)。 */
function presetFromDisk(sid: string): string | null {
  try {
    const store = join(homedir(), '.dsh', 'sessions')
    if (!existsSync(store)) return null
    for (const slug of readdirSync(store)) {
      const file = join(store, slug, sid, 'session.jsonl.zstd')
      if (!existsSync(file)) continue
      const out = execFileSync('zstd', ['-dc', file], {
        encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 15000,
      })
      let last: any = null
      for (const line of out.split('\n')) {
        if (!line.includes('agent-preset/selected')) continue
        try { last = JSON.parse(line) } catch { /* skip malformed */ }
      }
      const p = last?.data?.agentPreset
      return typeof p === 'string' ? p : null
    }
    return null
  } catch {
    return null
  }
}

/** 论文阅读模式提示词段(仅注入允许的预设会话)。 */
const PAPER_SECTION_TEXT = [
  '## 论文阅读模式(paper-reading plugin)',
  '用户在阅读文献时会复制文字或图片给你。请遵守:',
  '1. 用户粘贴文字后,先用 paper_capture 清洗并归档到当前论文(它会处理 PDF 断行/连字符/页码,且会自动识别内容所属论文:若粘贴文本含库中另一篇论文的完整标题,会自动切换当前论文并归档)。回答时基于该论文记忆;若内容明显不属于当前论文又无法自动识别(标题未出现),先询问用户是哪篇论文再归档。',
  '1b. 用户拖入 PDF 文件或给出 PDF 路径时,先用 paper_attach_pdf 归档(提取元信息+全文),再基于提取文本解读。注意:paper_attach_pdf 的 title 必填——用户未给论文名时,必须先询问论文题目再归档;归档自动进入「默认」文件夹;需要看图表时配合 paper_read_figure。',
  '2. 用户给出图片路径/URL 或粘贴图片时,用 paper_read_figure 读取并归档(OCR 全文 + 摘要),基于转录内容解读图表/公式/页面,不要臆测图片内容。',
  '3. 解释论文内容时:忠于原文、指出所在章节/公式编号、公式用 LaTeX、不确定处明确标注、按需维护术语表(paper_glossary add)。',
  '4. 深度阅读时用 paper_qa 把有价值的问答归档;回答前可用 paper_summary 回顾已归档内容,避免重复解释。',
  '5. 需要回顾读过什么时用 paper_summary(scope=today/current/all);跨论文检索用 paper_find。',
  '6. 回答语言跟随用户。',
].join('\n')

/** 静态文件路由工厂:把 prefix 下的请求映射到 rootDir,带 MIME 表与防穿越。 */
function staticFileHandler(rootDir: string, prefix: string) {
  return async (req: any, res: any) => {
    const url = String(req?.url ?? '')
    const pathname = decodeURIComponent(url.split('?')[0])
    const rel = pathname.slice(prefix.length)
    const file = resolve(rootDir, '.' + rel)
    if (!file.startsWith(rootDir + sep) || !existsSync(file)) {
      return json(res, { ok: false, error: 'not found' })
    }
    let body: Buffer
    try {
      body = readFileSync(file)
    } catch {
      return json(res, { ok: false, error: 'not found' })
    }
    res.statusCode = 200
    res.setHeader('content-type', PDFJS_MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('cache-control', 'no-cache')
    res.end(body)
  }
}

const PDFJS_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.cur': 'image/x-icon',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.ftl': 'text/plain; charset=utf-8',
  '.properties': 'text/plain; charset=utf-8',
  '.map': 'application/json',
}

function json(res: any, obj: unknown): void {
  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(obj))
}

function readBody(req: any): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c: Buffer) => { data += c.toString() })
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function extOf(path: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(path)
  return m ? `.${m[1].toLowerCase()}` : '.png'
}

const MAGIC: Array<{ ext: string; test: (b: Buffer) => boolean }> = [
  { ext: '.png', test: b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { ext: '.jpg', test: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.gif', test: b => b.length >= 6 && (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a') },
  { ext: '.webp', test: b => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
]

function saveBase64Image(data: string, hintExt?: string): string {
  const m = /^data:image\/[a-z+.-]+;base64,(.*)$/i.exec(data)
  const base64 = m ? m[1] : data
  const buf = Buffer.from(base64, 'base64')
  if (buf.length === 0) throw new Error('empty image payload')
  const sniff = MAGIC.find(x => x.test(buf))
  const ext = sniff?.ext ?? (hintExt && /^\.[a-z0-9]+$/i.test(hintExt) ? String(hintExt).toLowerCase() : '.png')
  const file = join(tmpdir(), `paper-reading-${randomUUID()}${ext}`)
  writeFileSync(file, buf)
  return file
}

/** Save a generic base64 payload (e.g. PDF) to a temp file with the given extension. */
function saveBase64File(data: string, ext: string): string {
  const m = /^data:[a-z0-9+./-]+;base64,(.*)$/i.exec(data)
  const base64 = m ? m[1] : data
  const buf = Buffer.from(base64, 'base64')
  if (buf.length === 0) throw new Error('empty payload')
  const file = join(tmpdir(), `paper-reading-${randomUUID()}${ext}`)
  writeFileSync(file, buf)
  return file
}

/** PDF magic-bytes check: %PDF- */
function isPdfFile(path: string): boolean {
  try {
    const head = readFileSync(path).subarray(0, 5).toString('latin1')
    return head === '%PDF-'
  } catch {
    return false
  }
}

/** Extract the paper id from a prefix route URL (/dsh-paper-reading/api/paper-pdf/<id>). */
function pathIdOf(req: any): string | null {
  const url = String(req?.url ?? '')
  const idx = url.lastIndexOf('/')
  if (idx < 0) return null
  const id = decodeURIComponent(url.slice(idx + 1).split('?')[0]).trim()
  return id.length > 0 ? id : null
}

// ── renderers (model-facing prose for tool outputs) ──────────────────────

function formatSwitch(value: any): string {
  const current = value.current
  const list = (value.papers ?? []).map((p: any) => `- ${p.title} (${p.id})`).join('\n') || '（空）'
  return current
    ? `当前论文: 《${current.title}》${value.created ? ' (新建)' : ''}\n论文库:\n${list}`
    : `论文库:\n${list}`
}

function formatCapture(value: any): string {
  const lines = [
    `论文: 《${value.paper?.title}》`,
    value.switchedTo ? `⚠️ 检测到内容属于《${value.switchedTo}》,已自动切换当前论文并归档` : '',
    `重复: ${value.duplicate ? '是(未重复归档)' : '否(已归档)'}`,
    value.savedPath ? `已保存: ${value.savedPath}` : '',
    `清理: 去掉 ${value.droppedLines} 行杂项`,
    '',
    '清洗后文本:',
    value.normalized,
  ]
  return lines.filter(Boolean).join('\n')
}

function formatFigure(value: any): string {
  const lines = [
    `论文: 《${value.paper?.title}》`,
    value.figurePath ? `已保存: ${value.figurePath}` : '',
    '',
    value.transcript,
  ]
  return lines.filter(Boolean).join('\n')
}

function formatGlossary(value: any): string {
  const entries = (value.entries ?? []).map((e: any) => `- **${e.term}** — ${e.explanation}`).join('\n') || '（暂无术语）'
  return `论文: 《${value.paper?.title}》${value.added ? ' (已新增)' : ''}\n${entries}`
}

function formatFind(value: any): string {
  const matches = value.matches ?? []
  if (matches.length === 0) return '（无匹配）'
  return matches.map((m: any) => `《${m.paper}》: ${m.match}`).join('\n')
}

function formatPdf(value: any): string {
  const lines = [
    `论文: 《${value.paper?.title}》`,
    `PDF 已归档: ${value.pdfPath}`,
    `标题: ${value.title}`,
    `页数: ${value.pages} · 大小: ${(value.bytes / 1024 / 1024).toFixed(1)} MB`,
    '',
    '提取文本(预览):',
    value.textPreview || '（无文本层——扫描版 PDF,请配合 paper_read_figure 逐页读图）',
  ]
  return lines.join('\n')
}
