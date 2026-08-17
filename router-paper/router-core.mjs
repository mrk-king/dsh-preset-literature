/**
 * router-core: 文献感知路由核心（零依赖）。
 *
 * 在 router-flash（w7 神模式引导,作者 dsh-router-standard 实测）基础上,
 * 增加第四个模式 `paper`（文献精读）：
 *
 *   paper → 精读模式:学者 persona + 论文工具优先 + 深度思考锚。
 *           论文/文献关键词、LaTeX/数学标记、粘贴长文信号都会命中。
 *   spec  → 规划优先（修复/维护类任务,回退原逻辑）
 *   react → 直接动手（构建类任务,回退原逻辑）
 *   weak  → 内部路由（模型自判,Flash 默认带 w7 锚）
 *
 * 所有导出保持零外部依赖（preset 从用户 home 解析,node_modules 不可用）。
 */

export const MODE_SPEC = 0
export const MODE_MIXED = 0.3
export const MODE_REACT = 1
export const MODE_WEAK = 'weak'
export const MODE_PAPER = 'paper'

const SPEC_PERSONA = 'You are a helpful software engineer assistant.'

const MIXED_PERSONA =
  'You are a helpful software engineer assistant.\n'
  + 'Work directly: prefer writing or editing code over describing plans. '
  + 'Verify your changes by reading and running them.'

const REACT_PERSONA =
  'You are a hands-on software engineer who delivers working output fast.\n'
  + 'Work directly: write or edit code, then verify it by reading and running. '
  + 'Keep the loop tight — produce, verify, fix — and do not build test '
  + 'harnesses, scaffolding, or ceremony the user did not ask for. '
  + 'Finish with a usable deliverable and a short summary.'

/** Weak (internal-routing) personas — model-specific optimum (P11/P24). */
const WEAK_PRO =
  'You are a helpful software engineer assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.'

const WEAK_FLASH =
  'You are a helpful assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.\n'
  + 'Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps. Do not run environment checks (echo, whoami, uname, node --version, date) or exhaustive grep/glob scans.\n'
  + 'Think deeply about the architecture, edge cases, and integration points before writing. Do not spend reasoning on the environment or tooling. Produce when your information is complete, and end each reasoning block with a decision or an information need.'

/**
 * 文献精读 persona（本预设的核心交付物）。
 * Flash 版:学者规范 + w7 深度思考锚;Pro 版:去掉锚,保持精简。
 */
const PAPER_FLASH =
  'You are a meticulous scholarly reader and research assistant, currently in 精读模式 (close-reading mode).\n'
  + 'Working with literature, you: '
  + '1) stay faithful to the source — explain what the text actually says, never invent details, cite the section/figure/equation numbers the user gave (or the snippet position), and flag anything unclear explicitly; '
  + '2) write every formula in LaTeX and walk through symbols and derivation steps; '
  + '3) treat pasted paper text as messy PDF copy: first run paper_capture to clean and archive it, then answer from the cleaned text; '
  + '4) when the user shares an image (figure/table/page scan), run paper_read_figure and base the answer on its transcript — never guess image content; '
  + '5) maintain the paper\'s glossary with paper_glossary add, archive valuable Q&A with paper_qa, and review archived notes with paper_summary before deep-reading answers to avoid repeating prior explanations; '
  + '6) use paper_find for cross-paper recall and paper_summary(scope=today) for daily reading reports; '
  + '7) follow the user\'s language (usually Chinese).\n'
  + 'Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps.\n'
  + 'Think deeply about the material, its edge cases, and connections to related work before writing. Produce when your information is complete, and end each reasoning block with a decision or an information need.'

const PAPER_PRO =
  'You are a meticulous scholarly reader and research assistant, currently in 精读模式 (close-reading mode).\n'
  + 'Stay faithful to the source: explain what the text actually says, cite section/figure/equation numbers, flag uncertainty, write formulas in LaTeX, and follow the user\'s language (usually Chinese). '
  + 'Pasted paper text is messy PDF copy: run paper_capture first to clean and archive it, then answer from the cleaned text. '
  + 'For images use paper_read_figure and base the answer on the transcript. '
  + 'Maintain the paper\'s glossary (paper_glossary add), archive valuable Q&A (paper_qa), and review archived notes with paper_summary before deep-reading answers. '
  + 'Use paper_find for cross-paper recall and paper_summary(scope=today) for daily reading reports.'

/** 文献命中关键词（中英）。 */
const PAPER_RE = /(论文|文献|文章|段落|摘要|引言|结论|实验|方法|术语|精读|解读|讲解|解释|说明|含义|什么意思|怎么理解|这段|翻译|综述|引用|参考文献|arxiv|doi|abstract|introduction|conclusion|methodology|literature|survey|paper|article|figure|table|equation|section|sec\.|glossary|terminology|cite|reading)/i

/** LaTeX / 数学标记 → 几乎必然是论文内容。 */
const MATH_RE = /(\\begin\{|\\label\{|\\frac|\\sum|\\int|\\alpha|\\beta|\\theta|\\lambda|\\sigma|\$\$|\$[a-zA-Z\\])/

/** 粘贴长文信号:超长 + 含学术结构词。 */
const PASTE_RE = /(摘要|abstract|引言|introduction|参考文献|references|doi|arxiv)/i

/** 复杂度启发(沿用):长或架构词任务 = COMPLEX。 */
const COMPLEX_RE = /(重构|架构|全面|详细|设计|系统|优化|分析|survey|overview|architecture|refactor|comprehensive|detailed|design|system|optimize|analyze)/i

export function isComplexTask(text) {
  return typeof text === 'string' && (text.length > 120 || COMPLEX_RE.test(text))
}

/** True when the routed model id is a Flash-family model. */
export function isFlashModel(modelId) {
  return typeof modelId === 'string' && /flash/i.test(modelId)
}

/**
 * 文献任务判定:关键词命中 / 数学标记 / 粘贴长文信号。
 * 注意“paper”一词本身不单独触发(避免 paperclip/white paper 之类误伤),
 * 但文献常见上下文词(abstract/figure/table/section/术语/解读/翻译等)会命中。
 */
export function isPaperTask(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return false
  if (MATH_RE.test(text)) return true
  if (PAPER_RE.test(text)) return true
  if (text.length > 600 && PASTE_RE.test(text)) return true
  return false
}

export function clamp01(v) {
  return Math.min(1, Math.max(0, Number(v) || 0))
}

/** Quantize a mode to one of the measured behavior bands (+ paper). */
export function bandOf(mode) {
  if (mode === MODE_WEAK) return 'weak'
  if (mode === MODE_PAPER) return 'paper'
  const m = clamp01(mode)
  if (m < 0.2) return 'spec'
  if (m < 0.5) return 'transition'
  return 'react'
}

/** Persona for a mode; paper/weak pick the model-specific internal-routing text. */
export function personaFor(mode, modelId) {
  switch (bandOf(mode)) {
    case 'paper': return isFlashModel(modelId) ? PAPER_FLASH : PAPER_PRO
    case 'spec': return SPEC_PERSONA
    case 'transition': return MIXED_PERSONA
    case 'weak': return isFlashModel(modelId) ? WEAK_FLASH : WEAK_PRO
    default: return REACT_PERSONA
  }
}

/** 文献精读首轮核心工具(与 paper-reading 插件 + modlens + 通用读写对齐)。 */
export function paperCore() {
  return [
    'paper_switch',
    'paper_attach_pdf',
    'paper_capture',
    'paper_read_figure',
    'paper_glossary',
    'paper_qa',
    'paper_summary',
    'paper_find',
    'modlens_read_image',
    'web_search',
    'read',
    'glob',
    'grep',
  ]
}

/** First-turn core tools (shell added dynamically by the plugin). */
export function coreFor(mode) {
  switch (bandOf(mode)) {
    case 'paper': return paperCore()
    case 'spec': return ['read', 'edit', 'glob', 'grep']
    case 'transition': return ['read', 'edit', 'write', 'glob', 'grep']
    default: return ['read', 'write', 'edit']
  }
}

/** Human-readable band name for a mode value. */
export function bandFor(mode) {
  const b = bandOf(mode)
  return b === 'transition' ? 'mixed' : b
}

/** Test-suppression strength for a mode (informational). */
export function testinessFor(mode) {
  switch (bandOf(mode)) {
    case 'paper': return 'light'
    case 'react': return 'suppressed'
    case 'spec': return 'normal'
    default: return 'light'
  }
}

const REACT_RE = /(开发|创建|写一个|生成|从零|做一个|游戏|网页|网站|构建|新项目|搭建|实现|做出|上线|落地|脚本|工具|应用|build|create|develop|generate|implement|make a|new project)/gi
const SPEC_RE = /(修复|修一下|调试|重构|维护|排查|报错|出错|崩溃|优化|审查|review|fix|debug|refactor|maintain|repair|broken|break|为什么|异常|故障|迁移|升级|兼容)/gi

function countHits(regex, text) {
  return [...text.matchAll(regex)].length
}

/**
 * 任务分类:文献 → 'paper';build/fix 关键词分胜负 → 1/0;
 * 无明确证据 → 'weak'(内部路由)。
 */
export function classifyTask(text) {
  if (isPaperTask(text)) return MODE_PAPER
  const react = countHits(REACT_RE, text)
  const spec = countHits(SPEC_RE, text)
  if (react > spec) return 1
  if (spec > react) return 0
  return MODE_WEAK
}

/** Per-session mode derived from durable events (resume-safe).
 *  rc.6 注意:首轮 assemble 时当前 user/message 尚未入 events,
 *  因此返回 undefined(调用方按"未知模式"处理:不限制工具面,
 *  persona 用 weak 基准);第二轮起由首条用户消息稳定分类。 */
export function sessionMode(session) {
  if (!session || !Array.isArray(session.events)) return undefined
  const userMsg = session.events.find((e) => e.type === 'user/message')
  if (!userMsg) return undefined
  return classifyTask(extractText(userMsg?.data))
}

export function extractText(data) {
  if (!data) return ''
  const payload = data && typeof data.message === 'object' && data.message !== null ? data.message : data
  const content = Array.isArray(payload.content) ? payload.content : []
  return content.map((c) => (typeof c === 'string' ? c : (c.text ?? ''))).join(' ')
}

/**
 * Replace only the persona section of an assembled section list, keeping
 * everything else — the paper-reading plugin's workflow section above all.
 */
export function applyPersona(sections, personaText) {
  const rest = (sections || []).filter(
    (section) => section.name !== 'persona' && !/persona/i.test(section.name),
  )
  return [...rest, { name: 'router-persona', text: personaText, order: 0 }]
}

/** 文献模式每轮近场引导(仅当 session/event 监听在 rc.6 可用时生效)。 */
export const PAPER_GUIDE =
  '\nRouter: 文献精读模式 — 粘贴内容先用 paper_capture 清洗归档;图片用 paper_read_figure;回答忠于原文、公式 LaTeX、不确定处标注;深度阅读后用 paper_qa 归档、术语入 paper_glossary。语言跟随用户。'

/** Parse a user/agent-supplied mode token: number 0-100, 0.0-1.0, or a band name. */
export function parseMode(token) {
  if (token === undefined || token === null) return null
  const t = String(token).trim().toLowerCase()
  if (t === 'auto') return 'auto'
  if (t === 'paper' || t === '文献' || t === '精读') return MODE_PAPER
  if (t === 'weak' || t === 'router') return MODE_WEAK
  if (t === 'spec' || t === 'spec-lean') return 0
  if (t === 'balanced' || t === 'mixed') return 0.3
  if (t === 'react' || t === 'react-lean') return 1
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  if (t.includes('.')) return clamp01(n)
  return clamp01(n / 100)
}
