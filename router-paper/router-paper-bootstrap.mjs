/**
 * router-paper-bootstrap: 文献感知路由插件（零依赖）。
 *
 * 在 system-prompt/assemble 阶段:
 *  - 从 durable 会话事件分类模式(paper / spec / react / weak);
 *    rc.6 首轮当前消息尚未入 events → 模式未知 → 不限制工具面
 *    (论文工具与全目录首轮即用,paper-reading 插件的全局工作流段落兜底);
 *  - 模式已知后注入对应 persona(paper → 精读学者 persona),
 *    首轮(首次 tool/call 前)只暴露模式核心工具集,之后放开全目录;
 *  - 防御性监听 session/event:文献消息追加近场引导(rc.6 若不可用则静默跳过)。
 *
 * 自省工具:dev_paper_status / dev_paper_mode(与 router-standard 同款,
 * 支持 paper/spec/weak/react/auto 与 0-100 / 0.0-1.0)。
 */

import {
  applyPersona, bandFor, coreFor, parseMode, personaFor, sessionMode, clamp01,
  isFlashModel, isPaperTask, PAPER_GUIDE,
} from './router-core.mjs'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'router-paper-bootstrap'

/** Prompt assembly and the tools registry must exist. */
export const inject = ['systemPrompt', 'tools']

/** Minimal spec → JSON Schema compiler (subset of defineTool's work). */
function toJsonSchema(spec) {
  const properties = {}
  const required = []
  for (const [key, meta] of Object.entries(spec || {})) {
    const prop = { type: meta.type }
    if (Array.isArray(meta.enum)) prop.enum = meta.enum
    if (meta.description) prop.description = meta.description
    properties[key] = prop
    if (meta.required) required.push(key)
  }
  return { type: 'object', properties, required, additionalProperties: false }
}

export function apply(ctx, config) {
  const overrides = new Map() // session id -> explicit mode
  const agents = new Map() // session id -> Agent (live handle, in-process only)

  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    const session = agent.session
    agents.set(session.id, agent)

    const mode = overrides.get(session.id) ?? sessionMode(session)
    const modelId = agent.options?.model
    // 首轮(模式未知):Flash 用 weak 基准 persona;非 Flash 用 neutral。
    const effective = mode ?? (isFlashModel(modelId) ? 'weak' : undefined)
    const persona = personaFor(effective ?? 'weak', modelId)
    const sections = applyPersona(assembled.sections, persona)

    if (session.events.some((event) => event.type === 'tool/call')) {
      return { ...assembled, sections, contexts: [] } // promoted: full catalog
    }

    // 模式未知(首轮)→ 不限制工具面:论文工具/视觉/搜索全可用。
    if (mode === undefined) {
      return { ...assembled, sections, contexts: [] }
    }

    const core = new Set(coreFor(mode))
    const available = new Set(assembled.tools.map((tool) => tool.name))
    const shell = available.has('pwsh') ? 'pwsh' : available.has('bash') ? 'bash' : null
    if (shell === null) {
      throw new Error(`${name}: no platform shell in catalog`)
    }
    core.add(shell)

    return {
      ...assembled,
      sections,
      contexts: [],
      tools: assembled.tools.filter((tool) => core.has(tool.name)),
    }
  })

  // ── 文献近场引导(防御性:rc.6 若 session/event 对 preset 作用域不可达则静默)──
  ctx.on('session/event', (session, event) => {
    try {
      if (event?.type !== 'user/message') return
      const data = event.data ?? {}
      if (data.source?.kind !== 'user') return // only real user messages
      const agent = ctx.get('agent')
      const target = agent !== undefined && agent.session === session
        ? agent
        : [...agents.values()].find((a) => a.session === session)
      if (target === undefined || target.inbox === undefined) return
      const text = extractText(data)
      if (!isPaperTask(text)) return
      target.inbox.append('next-step', {
        id: `router-paper-guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        source: { kind: 'plugin', plugin: 'router-paper-bootstrap' },
        content: [{ type: 'text', text: PAPER_GUIDE }],
      })
    } catch { /* rc.6 兼容:监听或 inbox 不可用时静默降级 */ }
  })

  // ── 自省与调优工具 ────────────────────────────────────────────────────────
  const registerTool = (tool) => {
    ctx.effect(() => ctx.tools.register({
      ...tool,
      parameters: toJsonSchema(tool.parameters),
    }))
  }

  function fmtMode(mode) {
    return typeof mode === 'string' ? mode : mode.toFixed(2)
  }

  registerTool({
    name: 'dev_paper_status',
    description: 'Show this session\'s paper-aware routing: mode, band, persona, first-turn core tools, and whether an override is active.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute() {
      const session = currentSession()
      if (session === undefined) return 'no agent session'
      const mode = overrides.get(session.id) ?? sessionMode(session)
      const modelId = currentAgent()?.options?.model
      return [
        `mode=${mode === undefined ? 'unknown(first turn)' : fmtMode(mode)} (band=${mode === undefined ? 'n/a' : bandFor(mode)})`,
        `persona=${personaFor(mode ?? (isFlashModel(modelId) ? 'weak' : 'weak'), modelId).replace(/\n/g, ' / ')}`,
        `core=[${mode === undefined ? 'full catalog (first turn)' : coreFor(mode).join(', ')}]`,
        `override=${overrides.has(session.id) ? 'yes' : 'no'}`,
      ].join('\n')
    },
  })

  registerTool({
    name: 'dev_paper_mode',
    description: 'Set this session\'s paper-aware mode: paper (文献精读) / spec (plan-first) / weak (internal routing) / react (doer). Accepts band names, 0-100, or 0.0-1.0; use auto to return to task classification. The next request applies it.',
    parameters: {
      mode: {
        type: 'string',
        required: true,
        description: 'band name (paper / spec / weak / react), a 0-100 number, a 0.0-1.0 number, or auto to clear the override',
      },
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute(args) {
      const parsed = parseMode(args.mode)
      if (parsed === null) return `invalid mode "${args.mode}": use paper/spec/weak/react, 0-100, 0.0-1.0, or auto`
      const session = currentSession()
      if (session === undefined) return 'no agent session'
      if (parsed === 'auto') overrides.delete(session.id)
      else overrides.set(session.id, parsed === 'weak' || parsed === 'paper' ? parsed : clamp01(parsed))
      const current = overrides.get(session.id) ?? sessionMode(session)
      return `mode=${current === undefined ? 'unknown(first turn)' : fmtMode(current)} (band=${current === undefined ? 'n/a' : bandFor(current)}) — next request applies`
    },
  })

  function currentSession() {
    const agent = ctx.get('agent')
    if (agent !== undefined && agent.session !== undefined) return agent.session
    const last = [...agents.values()].at(-1)
    return last?.session
  }

  function currentAgent() {
    const session = currentSession()
    return session === undefined ? undefined : [...agents.values()].find((a) => a.session === session)
  }
}

function extractText(data) {
  if (!data) return ''
  const payload = data && typeof data.message === 'object' && data.message !== null ? data.message : data
  const content = Array.isArray(payload.content) ? payload.content : []
  return content.map((c) => (typeof c === 'string' ? c : (c.text ?? ''))).join(' ')
}
