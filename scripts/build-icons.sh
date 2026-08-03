#!/usr/bin/env bash
# icons/*.svg から拡張が使う PNG を書き出す。
#
# SVG から PNG への変換には Chrome のヘッドレスモードを使う。依存を増やさずに済むため。
# Chrome には SVG を任意のサイズで描かせる手段がないので、SVG の指定どおり 128px で
# 書き出してから sips (macOS 標準) で縮小する。
#
# 16px と 32px は icon-small.svg から作る。icon.svg の中の行は縮小すると 1px を割って消えるため。

set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICONS="$ROOT/icons"
WORK="${TMPDIR:-/tmp}/auto-rich-diff-icons"

if [[ ! -x "$CHROME" ]]; then
  echo "Chrome が見つからない: $CHROME" >&2
  exit 1
fi

mkdir -p "$WORK"

# SVG を 128px の透過 PNG にする
render() {
  local source="$1" out="$2"
  "$CHROME" \
    --headless \
    --disable-gpu \
    --force-device-scale-factor=1 \
    --default-background-color=00000000 \
    --window-size=128,128 \
    --screenshot="$out" \
    "file://$ICONS/$source" >/dev/null 2>&1
}

render icon.svg "$WORK/large.png"
render icon-small.svg "$WORK/small.png"

# 縮小して各サイズを書き出す
resize() {
  local source="$1" size="$2"
  sips -z "$size" "$size" "$source" --out "$ICONS/icon${size}.png" >/dev/null
  echo "icons/icon${size}.png"
}

cp "$WORK/large.png" "$ICONS/icon128.png"
echo "icons/icon128.png"
resize "$WORK/large.png" 48
resize "$WORK/small.png" 32
resize "$WORK/small.png" 16
