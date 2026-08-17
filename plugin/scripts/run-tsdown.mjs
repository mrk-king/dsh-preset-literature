// tsdown 0.22.14 需要 Promise.withResolvers(Node ≥22);Node 20 下先打 polyfill 再跑。
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject
    const promise = new Promise((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
}
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
const require = createRequire(import.meta.url)
const pkgRoot = dirname(require.resolve('tsdown/package.json'))
process.argv = [process.argv[0], join(pkgRoot, 'dist', 'run.mjs'), ...process.argv.slice(2)]
await import(pathToFileURL(join(pkgRoot, 'dist', 'run.mjs')).href)
