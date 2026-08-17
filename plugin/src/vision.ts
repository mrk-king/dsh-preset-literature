/**
 * Vision bridge: runs the modlens CLI (analyze mode) on an image path/URL and
 * returns the structured evidence object. Resolution order:
 *   config.modlensBin → $MODLENS_BIN → web-profile install → PATH lookup.
 * The CLI is spawned with `node` like the official modlens dsh plugin does.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface VisionEvidence {
  summary?: string
  ocr: { full_text: string; lines: Array<{ text: string; language?: string }> }
  layout: { regions: Array<{ type: string; reading_order: number; text: string }> }
  semantics: { scene?: string; intent?: string; entities: Array<{ name: string; type: string; evidence?: string }>; relations?: Array<{ subject: string; predicate: string; object: string }> }
  visual?: { dominant_colors?: string[]; style?: string; notes?: string[] }
  uncertainty?: string[]
}

export const VISION_TIMEOUT_MS = 180_000

const KNOWN_INSTALLS = [
  join(homedir(), '.dsh', 'profiles', 'web', 'node_modules', '@liustack', 'modlens', 'dist', 'main.js'),
]

export function resolveModlensBin(cfg: string): string | null {
  if (cfg && cfg.trim() !== '' && existsSync(cfg)) return cfg
  const env = process.env.MODLENS_BIN
  if (env && env.trim() !== '' && existsSync(env)) return env
  for (const candidate of KNOWN_INSTALLS) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function runNode(script: string, args: string[], timeoutMs: number, signal?: AbortSignal): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`modlens timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    const onAbort = () => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('modlens aborted by caller'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout.on('data', d => { stdout += String(d) })
    child.stderr.on('data', d => { stderr += String(d) })
    child.on('error', (e) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve({ stdout, stderr, code })
    })
  })
}

/**
 * Read an image through modlens. `pathOrUrl` is a local absolute path or an
 * http(s) URL. `prompt` is optional extra focus. Returns the evidence object
 * (`parsed.result` of the CLI JSON), the same shape the built-in
 * `modlens_read_image` tool returns.
 */
export async function readImage(
  bin: string,
  pathOrUrl: string,
  opts: { prompt?: string; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<VisionEvidence> {
  const args = [bin, '-i', pathOrUrl, '--timeout', String(opts.timeoutMs ?? VISION_TIMEOUT_MS)]
  if (opts.prompt) args.push('--prompt', opts.prompt)
  const { stdout, stderr, code } = await runNode(args[0], args.slice(1), (opts.timeoutMs ?? VISION_TIMEOUT_MS) + 20_000, opts.signal)
  if (code !== 0) {
    throw new Error(`modlens failed (exit ${code}): ${(stderr || stdout).trim().slice(0, 500)}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error(`modlens produced no JSON: ${stdout.trim().slice(0, 300)}`)
  }
  const result = (parsed as { result?: unknown }).result
  if (result == null || typeof result !== 'object') {
    throw new Error('modlens returned no result object')
  }
  return result as VisionEvidence
}

/** Compact human-readable rendering of evidence for notes / chat messages. */
export function renderEvidence(ev: VisionEvidence, maxChars = 8000): string {
  const parts: string[] = []
  if (ev.summary) parts.push(`摘要: ${ev.summary}`)
  const ocr = ev.ocr?.full_text?.trim()
  if (ocr) parts.push(`OCR 全文:\n${ocr.slice(0, maxChars)}`)
  else parts.push('OCR 全文: (空)')
  if (ev.semantics?.scene) parts.push(`场景: ${ev.semantics.scene}`)
  const entities = ev.semantics?.entities ?? []
  if (entities.length > 0) {
    parts.push(`实体: ${entities.slice(0, 12).map(e => `${e.name}(${e.type})`).join(', ')}`)
  }
  if (ev.uncertainty && ev.uncertainty.length > 0) {
    parts.push(`不确定: ${ev.uncertainty.slice(0, 5).join('; ')}`)
  }
  return parts.join('\n\n')
}
