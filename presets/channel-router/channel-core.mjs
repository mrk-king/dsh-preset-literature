/**
 * channel-core: 渠道检测与预设矩阵(零依赖)。
 *
 * 渠道 = provider 通道 × 模型家族,映射到社区实测预设:
 *
 *   官方 API (deepseek-official / pi-ai ...)
 *     flash → dsh-routing-suite      (router-standard: spec/react 任务路由)
 *     pro   → dsh-anchored-standard   (anchored: 首轮工具/预算锚定)
 *     其他  → myDshPresets warmupbetter (真实模型生成首轮 COT 热身)
 *   opencode-go
 *     flash → v4-flash-godmode        (router-flash: w7 神模式弱路由)
 *     其他  → myDshPresets warmupbetter-replay (重放预录 COT 热身)
 *
 * 文献任务(isPaperTask 命中)优先进入精读模式(router-paper 的学者 persona
 * 与论文核心工具),不随渠道变化——渠道只决定首轮机制与基准 persona。
 */

/** 渠道矩阵(顺序即优先级:具体型号在前,兜底渠道在后)。 */
export const CHANNEL_MATRIX = {
  'official-flash': {
    source: 'router-standard',
    providerRe: /deepseek|official|pi-ai/i,
    modelRe: /flash/i,
    label: '官方 API · Flash → dsh-routing-suite (router-standard)',
  },
  'official-pro': {
    source: 'anchored-standard',
    providerRe: /deepseek|official|pi-ai/i,
    modelRe: /pro/i,
    label: '官方 API · Pro → dsh-anchored-standard',
  },
  'official-other': {
    source: 'warmupbetter',
    providerRe: /deepseek|official|pi-ai/i,
    modelRe: null,
    label: '官方 API · 其他 → myDshPresets (warmupbetter)',
  },
  'opencode-flash': {
    source: 'router-flash',
    providerRe: /opencode/i,
    modelRe: /flash/i,
    label: 'opencode-go · Flash → v4-flash-godmode (router-flash)',
  },
  'opencode-other': {
    source: 'warmup-replay',
    providerRe: /opencode/i,
    modelRe: null,
    label: 'opencode-go · 其他 → myDshPresets (warmupbetter-replay)',
  },
}

/** 检测渠道;未知通道返回 undefined(中性兜底)。 */
export function detectChannel(provider, model) {
  const p = String(provider ?? '')
  const m = String(model ?? '')
  for (const [key, cfg] of Object.entries(CHANNEL_MATRIX)) {
    if (!cfg.providerRe.test(p)) continue
    if (cfg.modelRe === null) return key
    if (cfg.modelRe.test(m)) return key
  }
  if (/deepseek|official|pi-ai/i.test(p)) return 'official-other'
  if (/opencode/i.test(p)) return 'opencode-other'
  return undefined
}

/** 各渠道委托的源预设 bootstrap 模块(相对本 preset 目录)。 */
export const SOURCE_MODULES = {
  'router-standard': '../router-standard/router-bootstrap.mjs',
  'router-flash': '../router-flash/router-bootstrap.mjs',
  'anchored-standard': '../anchored-standard/tool-bootstrap.mjs',
  'warmup-replay': '../warmupbetter-replay/warmup-replay.mjs',
  warmupbetter: '../warmupbetter/warmup-bootstrap.mjs',
}

/** 各渠道的委托配置(与源 preset 的 agent.cordis.yml 行保持一致)。 */
export const SOURCE_CONFIGS = {
  'router-standard': {},
  'router-flash': {},
  'anchored-standard': {
    shellTools: ['bash', 'pwsh'],
    commonTools: ['read'],
    promoteOn: 'either',
    bootstrapMaxTokens: 1024,
    suppressedContextSources: ['agent-instructions', 'skill-catalog'],
  },
  'warmup-replay': {
    shellTools: ['bash', 'pwsh'],
    commonTools: ['str_replace_editor'],
    message: 'This round is a test. Tools are not open yet; all tools will open next round.',
  },
  warmupbetter: {
    shellTools: ['bash', 'pwsh'],
    commonTools: ['str_replace_editor'],
  },
}

/**
 * 首轮(用户消息尚未入 events,文献任务不可判定)的渠道基准核心工具。
 * 首轮工具面 = 渠道基准核心 ∪ 论文核心 ∪ shell:保持聚焦,同时保证
 * 拖入 PDF/粘贴文字时 paper_* 工具首轮即可用。
 */
export function baseCoreFor(channel) {
  switch (channel) {
    case 'official-pro':
    case 'opencode-other':
    case 'official-other':
      return ['read']
    default:
      return ['read', 'write', 'edit'] // flash 渠道沿用弱路由基准
  }
}

/** 提取首条真实用户消息文本(与 router-standard 同款防御解包)。 */
export function extractText(data) {
  if (!data) return ''
  const payload = data && typeof data.message === 'object' && data.message !== null ? data.message : data
  const content = Array.isArray(payload.content) ? payload.content : []
  return content.map((c) => (typeof c === 'string' ? c : (c.text ?? ''))).join(' ')
}

/** 会话是否处于文献精读模式(从 durable 首条用户消息判定)。 */
export function paperOfSession(session, isPaperTask) {
  if (!session || !Array.isArray(session.events)) return false
  const userMsg = session.events.find((e) => e.type === 'user/message')
  if (!userMsg) return false
  return isPaperTask(extractText(userMsg?.data))
}
