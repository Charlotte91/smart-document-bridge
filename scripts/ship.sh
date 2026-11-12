#!/usr/bin/env bash
# 수정한 내용을 점검 → 커밋 → GitHub 푸시 → Vercel 운영 배포 → 배포 주소 확인까지 한 번에 한다.
# 사용: npm run ship -- "커밋 메시지(한국어 한 줄)"
# 토큰은 .env에서 읽어 명령에만 넘기고 화면에는 출력하지 않는다. 어느 단계든 실패하면 거기서 멈춘다.
set -euo pipefail
cd "$(dirname "$0")/.."

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then echo "사용법: npm run ship -- \"커밋 메시지\""; exit 1; fi

REPO_URL="https://github.com/Charlotte91/smart-document-bridge.git"
SITE_URL="https://smart-document-bridge.vercel.app"

getenv() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d "\"' \r"; }
step() { printf '\n== %s\n' "$1"; }

[ -f .env ] || { echo ".env가 없습니다"; exit 1; }
GITHUB_TOKEN_VALUE="$(getenv GITHUB_TOKEN)"; VERCEL_TOKEN_VALUE="$(getenv VERCEL_TOKEN)"
[ -n "$GITHUB_TOKEN_VALUE" ] && [ -n "$VERCEL_TOKEN_VALUE" ] || { echo ".env에 GITHUB_TOKEN 또는 VERCEL_TOKEN 값이 없습니다"; exit 1; }
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || { echo "main 브랜치에서만 실행합니다"; exit 1; }

step "1/5 코드 검사 (lint + 타입)"
npm run lint --silent
npx tsc --noEmit

step "2/5 커밋 전 비밀 점검"
# 사용자가 따로 만든 발표 자료(.pptx)는 허락 없이 공개 저장소에 올리지 않는다
git add -A -- . ':(exclude)*.pptx'
if git status --porcelain | grep -E '\.pptx$' >/dev/null; then echo "(올리지 않고 제외한 파일: $(git status --porcelain | grep -E '\.pptx$' | wc -l | tr -d ' ')개 .pptx)"; fi
if git diff --cached --name-only | grep -iE '(^|/)\.env|node_modules/|^\.claude/|^\.bkit/|^\.vercel/|trash-can/'; then
  echo "올라가면 안 되는 파일이 포함되어 중단합니다 (위 목록)"; git reset -q; exit 1
fi
# 이 스크립트 자신은 검사 패턴 글자가 들어 있어 제외한다
if git diff --cached -U0 -- . ':(exclude)scripts/ship.sh' | grep -E 'ghp_|github_pat_|sk-[A-Za-z0-9]{10,}|vcp_|sbp_|AKIA|BEGIN (RSA|PRIVATE)' >/dev/null; then
  echo "비밀 키처럼 보이는 글자가 있어 중단합니다"; git reset -q; exit 1
fi
echo "이상 없음"

step "3/5 커밋·푸시"
if git diff --cached --quiet; then
  echo "새로 커밋할 변경 없음"
else
  git commit -q -m "$MESSAGE" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
  git log --oneline -1
fi
GITHUB_TOKEN_VALUE="$GITHUB_TOKEN_VALUE" git -c credential.helper='!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN_VALUE"; }; f' push -q "$REPO_URL" main
git fetch -q "$REPO_URL" main 2>/dev/null || true
echo "푸시 완료: $(git rev-parse --short HEAD) → ${REPO_URL%.git}"

step "4/5 Vercel 운영 배포"
VERCEL_TOKEN="$VERCEL_TOKEN_VALUE" npx --yes vercel@latest --yes --prod 2>&1 | grep -iE "Production URL|ready|error|failed" | grep -vi token | tail -5

step "5/5 배포 확인"
sleep 3
code="$(curl -s -o /tmp/_ship_page.html -w '%{http_code}' "$SITE_URL/")"
title="$(grep -c '스마트 문서/데이터 경량화 브릿지' /tmp/_ship_page.html || true)"
csp="$(curl -sI "$SITE_URL/run-code.worker.js" | grep -ci "connect-src 'none'" || true)"
mv /tmp/_ship_page.html /tmp/_ship_page.done 2>/dev/null || true
echo "홈 응답: $code / 제목 표시: $([ "$title" -gt 0 ] && echo 예 || echo 아니오) / Worker 보안 정책: $([ "$csp" -gt 0 ] && echo 있음 || echo 없음)"
if [ "$code" != "200" ] || [ "$title" -eq 0 ] || [ "$csp" -eq 0 ]; then echo "❌ 배포 확인 실패"; exit 1; fi
echo "✅ 배포 완료: $SITE_URL"
