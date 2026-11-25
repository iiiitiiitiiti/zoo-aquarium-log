#!/usr/bin/env bash
# 前に Discord へ送った更新のお知らせを、あとから書き換える。edit-discord-post.yml から呼ぶ（docs/decisions/005）。
# 書き換えられるのは、同じウェブフックが送った投稿だけ（Discord の決まり）。
#
# 環境変数:
#   DISCORD_WEBHOOK_URL  送り先。GitHub のシークレットから渡す
#   MESSAGE              投稿のリンクか番号。空なら notify が最後に残した番号を使う
#   CONTENT              新しい本文（全文）。空なら今の本文を出すだけで書き換えない
#   GH_TOKEN GITHUB_REPOSITORY  GitHub Actions が渡す（最後の番号を探すのに使う）
# 確かめるとき:
#   DRY_RUN=1  書き換えずに、書き換える中身を出す
set -euo pipefail

URL=$(printf '%s' "${DISCORD_WEBHOOK_URL:-}" | tr -d '[:space:]')
if [ -z "$URL" ]; then
  echo "DISCORD_WEBHOOK_URL が無いので書き換えられません" >&2
  exit 1
fi
BASE=${URL%%\?*}
BASE=${BASE%/}
# スレッドへ送るウェブフック（?thread_id=）なら、書き換えにも同じ指定が要る
case "$URL" in *\?*) QUERY="?${URL#*\?}" ;; *) QUERY="" ;; esac

MESSAGE=$(printf '%s' "${MESSAGE:-}" | tr -d '[:space:]')
if [ -n "$MESSAGE" ]; then
  # https://discord.com/channels/<サーバー>/<チャンネル>/<投稿> の最後の数字か、番号そのもの
  MESSAGE=${MESSAGE%%\?*}
  MESSAGE=${MESSAGE%/}
  POST_ID=${MESSAGE##*/}
else
  ARTIFACT=$(gh api "repos/$GITHUB_REPOSITORY/actions/artifacts?name=discord-post&per_page=1" \
    --jq '.artifacts[0] | select(. != null and (.expired | not)) | .id')
  if [ -z "$ARTIFACT" ]; then
    echo "最後に送った投稿の記録がありません（残すのは90日）。投稿のリンクを渡してください" >&2
    exit 1
  fi
  TMP=$(mktemp -d)
  gh api "repos/$GITHUB_REPOSITORY/actions/artifacts/$ARTIFACT/zip" > "$TMP/post.zip"
  POST_ID=$(unzip -p "$TMP/post.zip" discord-post.txt | tr -d '[:space:]')
fi

if ! printf '%s' "$POST_ID" | grep -Eq '^[0-9]{15,21}$'; then
  echo "投稿の番号が読み取れません: $POST_ID" >&2
  exit 1
fi
ENDPOINT="$BASE/messages/$POST_ID$QUERY"

# HTTP の状態コードだけを返し、応答の中身は第1引数のファイルに書く
call() {
  local out=$1
  shift
  curl -sS --retry 3 -o "$out" -w '%{http_code}' "$@"
}

BODY=$(mktemp)
if [ -z "${CONTENT:-}" ]; then
  STATUS=$(call "$BODY" "$ENDPOINT")
  if [ "$STATUS" != 200 ]; then
    echo "投稿 $POST_ID を読めませんでした（$STATUS）。このウェブフックが送った投稿か確かめてください" >&2
    echo "Discord の返事: $(jq -r '.message // ""' "$BODY" 2>/dev/null)" >&2
    exit 1
  fi
  echo "投稿 $POST_ID の今の本文:"
  jq -r '.content' "$BODY"
  exit 0
fi

# ${#CONTENT} はロケール次第でバイト数になるので jq で文字を数える
LENGTH=$(jq -rn --arg c "$CONTENT" '$c | length')
if [ "$LENGTH" -gt 2000 ]; then
  echo "本文が $LENGTH 字あります。Discord は2000字までです" >&2
  exit 1
fi
PAYLOAD=$(jq -n --arg content "$CONTENT" '{content: $content, allowed_mentions: {parse: []}}')

if [ -n "${DRY_RUN:-}" ]; then
  echo "投稿 $POST_ID を次の中身に書き換えます（DRY_RUN）"
  printf '%s\n' "$PAYLOAD"
  exit 0
fi

STATUS=$(printf '%s' "$PAYLOAD" | call "$BODY" -X PATCH -H "Content-Type: application/json" -d @- "$ENDPOINT")
if [ "$STATUS" != 200 ]; then
  echo "投稿 $POST_ID を書き換えられませんでした（$STATUS）。このウェブフックが送った投稿か確かめてください" >&2
  echo "Discord の返事: $(jq -r '.message // ""' "$BODY" 2>/dev/null)" >&2
  exit 1
fi
echo "投稿 $POST_ID を書き換えました。今の本文:"
jq -r '.content' "$BODY"
