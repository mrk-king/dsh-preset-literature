#!/usr/bin/env bash
# 📚 dsh-preset-literature 一键安装:预设 + 论文插件
set -euo pipefail

# 无论从哪个目录调用,都先切到脚本所在仓库根
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PRESETS=(channel-router router-paper)
AGENT_PRESETS_DIR="${AGENT_PRESETS_DIR:-$HOME/.dsh/.agent-presets}"
DSH_PROFILE_DIR="${DSH_PROFILE_DIR:-$HOME/.dsh/profiles/web}"

echo "==> 1/2 安装预设 → $AGENT_PRESETS_DIR"
mkdir -p "$AGENT_PRESETS_DIR"
for d in "${PRESETS[@]}"; do
  if [ ! -d "presets/$d" ]; then
    echo "!! 缺少 presets/$d,请确认在仓库根目录运行" >&2
    exit 1
  fi
  rm -rf "$AGENT_PRESETS_DIR/$d"
  cp -r "presets/$d" "$AGENT_PRESETS_DIR/"
done
echo "    已安装 ${#PRESETS[@]} 个预设目录"

echo "==> 2/2 安装论文插件 → $DSH_PROFILE_DIR"
TGZ="$(ls plugin/dist/dsh-external-dsh-paper-reading-*.tgz 2>/dev/null | head -1 || true)"
if [ -z "$TGZ" ]; then
  echo "!! 未找到 plugin/dist/*.tgz" >&2
  exit 1
fi
TGZ_ABS="$(cd "$(dirname "$TGZ")" && pwd)/$(basename "$TGZ")"
mkdir -p "$DSH_PROFILE_DIR"
if (cd "$DSH_PROFILE_DIR" && npm i "$TGZ_ABS" --no-audit --no-fund >/dev/null 2>&1); then
  echo "    插件已通过 npm 安装"
    # 注册 bundle:加入 profile 的 dsh.profile.bundles,确保 harness 加载
    python3 - "$DSH_PROFILE_DIR/package.json" <<'PYEOF'
import json, sys
p = sys.argv[1]
with open(p, encoding='utf-8') as f:
    d = json.load(f)
b = d.setdefault('dsh', {}).setdefault('profile', {}).setdefault('bundles', [])
if '@dsh-external/dsh-paper-reading' not in b:
    b.append('@dsh-external/dsh-paper-reading')
with open(p, 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')
print('    bundle 已注册:@dsh-external/dsh-paper-reading')
PYEOF
    # 移除 patch 里的禁用条目(若有)
    PATCH="$DSH_PROFILE_DIR/cordis.patch.yml"
    if [ -f "$PATCH" ]; then
      python3 - "$PATCH" <<'PYEOF'
import sys, re
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
lines = [l for l in s.split('
') if re.search(r'disabled:\s*true', l) and 'paper-reading' in l]
if lines:
    print('    ⚠️ 检测到禁用条目,请手动检查:', lines)
PYEOF
    fi
else
  echo "    npm 安装失败,改用直接解压(node_modules/@dsh-external/dsh-paper-reading)"
  TMP="$(mktemp -d)"
  tar -xzf "$TGZ" -C "$TMP"
  mkdir -p "$DSH_PROFILE_DIR/node_modules/@dsh-external"
  rm -rf "$DSH_PROFILE_DIR/node_modules/@dsh-external/dsh-paper-reading"
  mv "$TMP/package" "$DSH_PROFILE_DIR/node_modules/@dsh-external/dsh-paper-reading"
  rm -rf "$TMP"
  echo "    插件已解压安装"
fi

MODLENS="$DSH_PROFILE_DIR/node_modules/@liustack/modlens/dist/main.js"
if [ -f "$MODLENS" ] || [ -n "${MODLENS_BIN:-}" ]; then
  echo "    视觉引擎 ModLens:已就绪 ✅"
else
  echo "    视觉引擎 ModLens:未安装(可选)——图片解读不可用,其余功能正常"
fi

echo ""
echo "✅ 安装完成!"
echo "下一步:"
echo "  1. 重启 DeepSeek Harness"
echo "  2. 在预设选择器选「📚 文献精读 · Router Paper」(可设为默认)"
echo "  3. 打开会话,右下角「📄 论文」→ 拖入 PDF 即用"
echo ""
echo "卸载: 删除 $AGENT_PRESETS_DIR/{${PRESETS[*]// /,}} 与"
echo "       $DSH_PROFILE_DIR/node_modules/@dsh-external/dsh-paper-reading"
