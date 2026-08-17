/**
 * channel-router-bootstrap: 渠道自适应路由插件(零依赖)。
 *
 * 检测会话的 (provider, model) → 匹配渠道矩阵 → 把该渠道对应的社区预设
 * 的 bootstrap 插件「按会话门控委托」到本 preset 的作用域上:
 *
 *   official+flash → router-standard 的 router-bootstrap.mjs
 *   official+pro   → anchored-standard 的 tool-bootstrap.mjs
 *   official+其他  → myDshPresets warmupbetter 的 warmup-bootstrap.mjs
 *   opencode+flash → router-flash 的 router-bootstrap.mjs
 *   opencode+其他  → myDshPresets warmupbetter-replay 的 warmup-replay.mjs
 *
 * 门控:每个源插件的监听器只在「本会话渠道匹配该源」时生效;文献任务
 * (isPaperTask)优先进入精读模式(router-paper 的学者 persona + 论文核心
 * 工具),并让源插件的 assemble/引导钩子让位。
 *
 * 源插件从 ~/.dsh/.agent-presets/<name>/ 动态 import(全部零依赖),
 * 与上游保持同步;未安装的源自动降级(日志警告 + 中性 persona)。
 */

import {
  CHANNEL_MATRIX, SOURCE_MODULES, SOURCE_CONFIGS, baseCoreFor, detectChannel, extractText,
} from './channel-core.mjs'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'channel-router-bootstrap'

/** Prompt assembly and the tools registry must exist. */
export const inject = ['systemPrompt', 'tools']

/** 兜底 persona(源预设缺失时):Flash 用 w7 基准,其他中性。 */
const FALLBACK_FLASH =
  'You are a helpful assistant.\n'
  + 'Before acting, decide the task type (build or fix) and adopt the matching '
  + 'style: build → hands-on production; fix → inspect-and-plan.\n'
  + 'Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps.\n'
  + 'Think deeply about the architecture, edge cases, and integration points before writing. Produce when your information is complete, and end each reasoning block with a decision or an information need.'
const FALLBACK_NEUTRAL = 'You are a helpful assistant.\nBefore acting, decide the task type (build or fix) and adopt the matching style: build → hands-on production; fix → inspect-and-plan.'

export async function apply(ctx, config) {
  /** sid → { channel, source, paper, fallbackPersona } */
  const sessionInfo = new Map()
  /** 已加载的源插件模块(source id → module)。 */
  const loaded = new Map()
  const warnings = new Set()

  const warnOnce = (msg) => {
    if (warnings.has(msg)) return
    warnings.add(msg)
    try { ctx.logger?.warn?.(msg) } catch { /* logger unavailable */ }
  }

  // ── 动态加载源插件(失败降级)────────────────────────────────────────────
  for (const [source, relPath] of Object.entries(SOURCE_MODULES)) {
    try {
      const url = new URL(relPath, import.meta.url)
      loaded.set(source, await import(url.href))
    } catch (error) {
      warnOnce(`[channel-router] source preset "${source}" not loaded (${relPath}): ${error?.message ?? String(error)} — sessions on that channel degrade to the neutral persona`)
    }
  }

  // ── 文献精读核心(router-paper,缺失则内联兜底)───────────────────────────
  let paper = null
  try {
    const url = new URL('../router-paper/router-core.mjs', import.meta.url)
    paper = await import(url.href)
  } catch {
    paper = {
      isPaperTask: (t) => /(论文|文献|摘要|abstract|figure|table|公式|精读|翻译|术语|doi|arxiv|equation|section)/i.test(String(t ?? '')),
      paperCore: () => ['read', 'glob', 'grep', 'web_search'],
      applyPersona: (sections, text) => [
        ...(sections || []).filter((s) => s.name !== 'persona' && !/persona/i.test(s.name)),
        { name: 'router-persona', text, order: 0 },
      ],
      personaFor: () => FALLBACK_NEUTRAL,
      PAPER_GUIDE: '\nRouter: 文献精读模式 — 粘贴内容先用 paper_capture 清洗归档;图片用 paper_read_figure;回答忠于原文、公式 LaTeX。',
    }
  }

  // ── 会话信息:渠道 + 文献判定(paper 每次重算——首轮 user/message 入
  //    events 后翻转,使第二轮起文献模式生效)───────────────────────────────
  function infoOf(agent) {
    if (!agent?.session?.id) return undefined
    const sid = agent.session.id
    const channel = detectChannel(agent.options?.provider, agent.options?.model)
    const info = {
      sid,
      channel,
      source: channel === undefined ? undefined : CHANNEL_MATRIX[channel].source,
      paper: paper.isPaperTask(extractText(firstUserMessage(agent.session))),
    }
    sessionInfo.set(sid, info)
    return info
  }

  function firstUserMessage(session) {
    if (!session || !Array.isArray(session.events)) return undefined
    return session.events.find((e) => e.type === 'user/message')?.data
  }

  function hasUserMessage(session) {
    return Boolean(firstUserMessage(session))
  }

  function fallbackPersonaFor(modelId) {
    return /flash/i.test(String(modelId ?? '')) ? FALLBACK_FLASH : FALLBACK_NEUTRAL
  }

  // ── 门控委托上下文:源插件的监听器只在本会话渠道匹配时生效 ──────────────
  function gatedCtx(sourceKey) {
    return {
      logger: ctx.logger,
      get: ctx.get,
      effect: ctx.effect,
      tools: ctx.tools,
      on(event, listener, options) {
        // Preserve each Cordis event's return contract. In particular,
        // llm/stream must return AsyncIterable directly; an async wrapper
        // would turn it into Promise<AsyncIterable> and break downstream yield*.
        return ctx.on(event, (first, second, third) => {
          const verdict = gate(event, sourceKey, first, second)
          if (verdict === 'skip') {
            const nxt = typeof second === 'function' ? second : third
            return nxt ? nxt() : undefined
          }
          return listener(first, second, third)
        }, options)
      },
    }
  }

  /** 门控判定:skip = 本会话渠道/文献模式与该源不匹配,原样放行(next)。 */
  function gate(event, sourceKey, first, second) {
    const agent = first?.agent ?? second?.agent
    if (agent !== undefined) {
      const info = infoOf(agent)
      if (info?.source !== sourceKey) return 'skip'
      const firstTurn = !hasUserMessage(agent.session)
      // 文献精读模式或首轮(用户消息尚未入 events)让源插件的 assemble 让位:
      // 首轮由我的钩子做「渠道核心 ∪ 论文核心」过滤,保证 paper_* 首轮可用。
      if (event === 'system-prompt/assemble' && (info.paper || firstTurn)) return 'skip'
      if (event === 'session/event' && info.paper) return 'skip'
      return 'allow'
    }
    if (first?.sessionId !== undefined) {
      // llm/stream 等仅带 sessionId 的载荷:信任会话缓存;缺失时放行
      // (源插件自身的会话标记仍然生效)。
      const info = sessionInfo.get(first.sessionId)
      if (info !== undefined && (info.source !== sourceKey || info.paper)) return 'skip'
      return 'allow'
    }
    if (first?.events !== undefined && first?.id !== undefined) {
      // session/event:(session, event)
      const info = sessionInfo.get(first.id)
      if (info === undefined || info.source !== sourceKey || info.paper) return 'skip'
      return 'allow'
    }
    return 'allow'
  }

  // ── 我的 assemble 钩子(先注册 = 最外层变换):渠道登记 + 文献精读模式 ────
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const assembled = await next()
    const agent = context.agent
    if (agent === undefined) return assembled
    const info = infoOf(agent)
    if (info === undefined) return assembled

    if (!info.paper) {
      // 首轮(用户消息尚未入 events):源 assemble 已让位,这里做
      // 「渠道基准核心 ∪ 论文核心 ∪ shell」过滤,并注入渠道兜底 persona。
      if (!hasUserMessage(agent.session)) {
        const persona = fallbackPersonaFor(agent.options?.model)
        const sections = paper.applyPersona(assembled.sections, persona)
        if (agent.session.events.some((e) => e.type === 'tool/call')) {
          return { ...assembled, sections, contexts: [] }
        }
        const core = new Set(baseCoreFor(info.channel))
        for (const t of paper.paperCore()) core.add(t)
        const available = new Set(assembled.tools.map((t) => t.name))
        const shell = available.has('pwsh') ? 'pwsh' : available.has('bash') ? 'bash' : null
        if (shell !== null) core.add(shell)
        return {
          ...assembled,
          sections,
          contexts: [],
          tools: assembled.tools.filter((t) => core.has(t.name)),
        }
      }
      // 非文献会话:若该渠道源缺失,用兜底 persona 保持神模式基准。
      if (info.source !== undefined && !loaded.has(info.source)) {
        const persona = fallbackPersonaFor(agent.options?.model)
        return { ...assembled, sections: paper.applyPersona(assembled.sections, persona), contexts: [] }
      }
      return assembled
    }

    // ── 文献精读模式:学者 persona + 论文核心工具(首次 tool/call 前) ──
    const modelId = agent.options?.model
    const persona = paper.personaFor('paper', modelId)
    const sections = paper.applyPersona(assembled.sections, persona)

    if (agent.session.events.some((e) => e.type === 'tool/call')) {
      return { ...assembled, sections, contexts: [] }
    }
    const core = new Set(paper.paperCore())
    const available = new Set(assembled.tools.map((t) => t.name))
    const shell = available.has('pwsh') ? 'pwsh' : available.has('bash') ? 'bash' : null
    if (shell !== null) core.add(shell)
    return {
      ...assembled,
      sections,
      contexts: [],
      tools: assembled.tools.filter((t) => core.has(t.name)),
    }
  })

  // ── 文献近场引导(防御性:rc.6 若事件不可达则静默)────────────────────────
  ctx.on('session/event', (session, event) => {
    try {
      if (event?.type !== 'user/message') return
      const data = event.data ?? {}
      if (data.source?.kind !== 'user') return
      const agent = ctx.get('agent')
      const target = agent !== undefined && agent.session === session ? agent : undefined
      if (target === undefined || target.inbox === undefined) return
      const text = extractText(data)
      if (!paper.isPaperTask(text)) return
      target.inbox.append('next-step', {
        id: `channel-paper-guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        source: { kind: 'plugin', plugin: 'channel-router-bootstrap' },
        content: [{ type: 'text', text: paper.PAPER_GUIDE }],
      })
    } catch { /* rc.6 兼容:静默降级 */ }
  })

  // ── 委托:把源插件的 apply 挂到门控上下文上 ─────────────────────────────
  for (const [sourceKey, mod] of loaded) {
    try {
      mod.apply(gatedCtx(sourceKey), SOURCE_CONFIGS[sourceKey] ?? {})
    } catch (error) {
      warnOnce(`[channel-router] source "${sourceKey}" apply failed: ${error?.message ?? String(error)}`)
    }
  }

  // ── 自省工具 ────────────────────────────────────────────────────────────
  ctx.effect(() => ctx.tools.register({
    name: 'dev_channel_status',
    description: 'Show this session\'s channel routing: detected channel, delegated source preset, paper mode, and which source presets are loaded.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    execute() {
      const agent = ctx.get('agent')
      const session = agent?.session
      if (session === undefined) return 'no agent session'
      const info = infoOf(agent)
      const channel = info?.channel
      const source = info?.source
      return [
        `provider=${agent.options?.provider ?? '?'} model=${agent.options?.model ?? '?'}`,
        `channel=${channel ?? 'unknown'} → source=${source ?? 'none'}${source !== undefined && loaded.has(source) ? ' (loaded)' : source !== undefined ? ' (MISSING, fallback persona)' : ''}`,
        `paper-mode=${info?.paper ?? false}`,
        `loaded-sources=${[...loaded.keys()].join(',') || '(none)'}`,
      ].join('\n')
    },
  }), 'channel-router: dev_channel_status')
}
