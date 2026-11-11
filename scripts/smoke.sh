#!/usr/bin/env bash
# End-to-end smoke test against a running server. Usage: scripts/smoke.sh [base] [name]
set -u
B=${1:-http://localhost:3210}; NAME=${2:-Mani}
J=$(mktemp); J2=$(mktemp); pass=0; fail=0
ok() { echo "PASS $1"; pass=$((pass+1)); }
no() { echo "FAIL $1 :: $2"; fail=$((fail+1)); }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
O=(-H "Origin: $B")

login() { # $1 jar $2 name
  local csrf; csrf=$(curl -s -c "$1" -b "$1" "$B/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
  curl -s -o /dev/null -c "$1" -b "$1" "${O[@]}" -X POST "$B/api/auth/callback/dev" --data-urlencode "csrfToken=$csrf" --data-urlencode "name=$2" --data-urlencode "callbackUrl=$B/"
}

[ "$(code "$B/api/threads")" = 401 ] && ok "unauth API -> 401" || no "unauth API" "$(code "$B/api/threads")"
[ "$(code -X POST "${O[@]}" -H 'content-type: application/json' -d '{"text":"hi"}' "$B/api/chat")" = 401 ] && ok "unauth chat -> 401" || no "unauth chat" x
[ "$(code "$B/")" = 307 ] && ok "home redirects to /login when signed out" || no "home redirect" "$(code "$B/")"
for p in /login /manifest.webmanifest /sw.js /icons/icon-192.png /offline.html; do [ "$(code "$B$p")" = 200 ] && ok "GET $p 200" || no "GET $p" "$(code "$B$p")"; done
LOGIN_HTML=$(curl -s "$B/login")
if echo "$LOGIN_HTML" | grep -q "Local dev mode"; then
  ok "login shows labelled dev mode"
  DEV=1
else
  ok "prod login has no dev mode form"
  DEV=0
fi
curl -sI "$B/login" | grep -qi "content-security-policy" && ok "CSP header present" || no "CSP" x
curl -sI "$B/login" | grep -qi "x-powered-by" && no "x-powered-by hidden" x || ok "x-powered-by hidden"
# Login page CSP should still be nonce-based (checked signed-in on / in dev).
CSP_LOGIN=$(curl -s -D - -o /dev/null "$B/login" | grep -i "^content-security-policy")
echo "$CSP_LOGIN" | grep -q "'nonce-" && echo "$CSP_LOGIN" | grep -q "strict-dynamic" && ok "login CSP uses per-request nonce" || no "login csp nonce" "$CSP_LOGIN"
curl -s -D - -o /dev/null "$B/api/threads" | grep -qi "content-security-policy: default-src 'none'" && ok "API responses get default-src 'none'" || no "api csp" x
[ "$(code "${O[@]}" -F "file=@/dev/null;filename=x.png;type=image/png" "$B/api/upload")" = 401 ] && ok "upload needs login" || no "upload auth" x
[ "$(code "$B/personality")" = 307 ] && ok "personality redirects when signed out" || no "personality redirect" "$(code "$B/personality")"
[ "$(code "$B/settings")" = 307 ] && ok "settings redirects when signed out" || no "settings redirect" "$(code "$B/settings")"
[ "$(code "$B/import")" = 307 ] && ok "import redirects when signed out" || no "import redirect" "$(code "$B/import")"
[ "$(code -X POST -H 'Origin: https://evil.example' -H 'content-type: application/json' -d '{"text":"hi"}' "$B/api/chat")" = 403 ] && ok "unauth cross-origin POST -> 403" || no "unauth csrf" x
[ "$(code -X POST -H 'content-type: application/json' -d '{"text":"hi"}' "$B/api/chat")" = 403 ] && ok "unauth POST without Origin -> 403" || no "unauth csrf no origin" x

if [ "$DEV" = 0 ]; then
  HDR=$(curl -sI "$B/login")
  echo "$HDR" | grep -qi "strict-transport-security" && ok "prod sets HSTS" || no "prod HSTS" x
  echo "$LOGIN_HTML" | grep -q "Dev login" && no "prod leaked Dev login button" x || ok "prod has no Dev login button"
  login "$J" "$NAME"
  grep -q "authjs.session-token" "$J" && no "prod dev login must not set a session" "cookie was set" || ok "prod rejects dev login callback"
  echo "---- prod mode: skipping signed-in checks (dev login is off)"
  echo "---- $pass passed, $fail failed"
  rm -f "$J" "$J2"
  [ "$fail" = 0 ]
  exit $?
fi

login "$J" "$NAME"
grep -q "authjs.session-token" "$J" && ok "dev login sets session cookie" || no "dev login" "no cookie"
for p in / /personality /settings /import; do [ "$(code -b "$J" "$B$p")" = 200 ] && ok "GET $p signed in 200" || no "GET $p" "$(code -b "$J" "$B$p")"; done

R=$(curl -s -b "$J" "${O[@]}" -H 'content-type: application/json' -d '{"text":"Is my code good? function add(a,b){return a-b}"}' "$B/api/chat")
echo "$R" | head -c 600; echo
echo "$R" | grep -q '"type":"meta"' && echo "$R" | grep -q '"type":"delta"' && echo "$R" | grep -q '"type":"done"' && ok "chat streams meta/delta/done" || no "chat stream" "$R"
echo "$R" | grep -q '"intent":"code"' && ok "router classified as code" || no "intent code" x
TID=$(echo "$R" | head -1 | sed -E 's/.*"threadId":"([^"]+)".*/\1/')
R2=$(curl -s -b "$J" "${O[@]}" -H 'content-type: application/json' -d "{\"threadId\":\"$TID\",\"regenerate\":true,\"steer\":\"harder\"}" "$B/api/chat")
echo "$R2" | grep -q '"vibe":"full_roast"' && ok "roast harder -> full_roast" || no "steer" "$(echo "$R2" | head -1)"
R3=$(curl -s -b "$J" "${O[@]}" -H 'content-type: application/json' -d "{\"threadId\":\"$TID\",\"text\":\"my grandmother died yesterday\"}" "$B/api/chat")
echo "$R3" | grep -q '"care":true' && echo "$R3" | grep -q '"mood":"care"' && ok "care override on grief" || no "care" "$(echo "$R3" | head -1)"
[ "$(code -b "$J" "$B/api/threads/$TID")" = 200 ] && ok "own thread readable" || no "own thread" x

[ "$(code -b "$J" "${O[@]}" -H 'content-type: application/json' -d '{"text":""}' "$B/api/chat")" = 400 ] && ok "empty message -> 400" || no "validation empty" x
[ "$(code -b "$J" "${O[@]}" -H 'content-type: application/json' -d '{"text":"hi","isAdmin":true}' "$B/api/chat")" = 400 ] && ok "unknown field -> 400 (strict)" || no "strict" x
[ "$(code -b "$J" -H 'Origin: https://evil.example' -H 'content-type: application/json' -d '{"text":"hi"}' "$B/api/chat")" = 403 ] && ok "cross-origin POST -> 403" || no "csrf" x
[ "$(code -b "$J" -H 'content-type: application/json' -d '{"text":"hi"}' "$B/api/chat")" = 403 ] && ok "POST without Origin -> 403" || no "csrf no origin" x
[ "$(code -b "$J" "${O[@]}" -X PUT -H 'content-type: application/json' -d '{"vibe":"chill","mawa":false}' "$B/api/settings")" = 200 ] && ok "settings PUT" || no "settings" x
[ "$(code -b "$J" "${O[@]}" -X PUT -H 'content-type: application/json' -d '{"vibe":"evil","mawa":false}' "$B/api/settings")" = 400 ] && ok "bad vibe -> 400" || no "settings validation" x
curl -s -b "$J" "${O[@]}" -X PUT -H 'content-type: application/json' -d '{"vibe":"sarcastic","mawa":true}' "$B/api/settings" >/dev/null

FX=$(dirname "$0")/../tests/fixtures
IR=$(curl -s -b "$J" "${O[@]}" -F "file=@$FX/chatgpt-export.zip;type=application/zip" "$B/api/import"); echo "$IR"
echo "$IR" | grep -q '"source":"chatgpt"' && echo "$IR" | grep -q '"conversations":2' && ok "ChatGPT zip import" || no "chatgpt import" "$IR"
IR2=$(curl -s -b "$J" "${O[@]}" -F "file=@$FX/gemini-takeout.zip;type=application/zip" "$B/api/import"); echo "$IR2"
echo "$IR2" | grep -q '"source":"gemini"' && ok "Gemini Takeout zip import" || no "gemini import" "$IR2"
BAD=$(curl -s -w " %{http_code}" -b "$J" "${O[@]}" -F "file=@$FX/zip-bomb.zip;type=application/zip" "$B/api/import"); echo "$BAD"
echo "$BAD" | grep -q " 422$" && ok "zip bomb rejected friendly 422" || no "zip bomb" "$BAD"
TH=$(curl -s -b "$J" "$B/api/threads"); echo "$TH" | grep -q '"kind":"imported"' && ok "imported chats in sidebar" || no "sidebar" "$TH"
IID=$(echo "$TH" | sed -E 's/.*"imported":\[\{"id":"([^"]+)".*/\1/')
[ "$(code -b "$J" "$B/api/imported/$IID")" = 200 ] && ok "own imported chat readable" || no "imported read" x
R4=$(curl -s -b "$J" "${O[@]}" -H 'content-type: application/json' -d '{"text":"remind me where I like biking?"}' "$B/api/chat")
echo "$R4" | grep -q '"type":"done"' && ok "chat after import works (profile + memory path)" || no "chat w/ memory" x

# Second user cannot see the first user's data (A01)
login "$J2" "Intruder"
[ "$(code -b "$J2" "$B/api/threads/$TID")" = 404 ] && ok "other user's thread -> 404" || no "IDOR thread" x
[ "$(code -b "$J2" "$B/api/imported/$IID")" = 404 ] && ok "other user's imported chat -> 404" || no "IDOR import" x
[ "$(code -b "$J2" "${O[@]}" -X DELETE "$B/api/threads/$TID")" = 404 ] && ok "other user can't delete thread" || no "IDOR delete" x
[ "$(code -b "$J2" "${O[@]}" -H 'content-type: application/json' -d "{\"threadId\":\"$TID\",\"text\":\"hi\"}" "$B/api/chat")" = 404 ] && ok "other user can't post into thread" || no "IDOR post" x
curl -s -b "$J2" "$B/api/threads" | grep -q "$TID" && no "IDOR list" x || ok "other user's sidebar is empty of A's chats"

[ "$(code -b "$J" "${O[@]}" -X DELETE "$B/api/import")" = 200 ] && ok "delete all imported data" || no "delete imports" x
curl -s -b "$J" "$B/api/threads" | grep -q '"kind":"imported"' && no "imports gone" x || ok "imported chats gone after delete"
curl -s -b "$J" "$B/api/import" | grep -q '"profile":null' && ok "profile removed" || no "profile removed" x

# ---- M2: uploads, media, voice, CSP ----
printf '\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\1\0\0\0\1\x08\x06\0\0\0\x1f\x15\xc4\x89\0\0\0\rIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\0\0\0\0IEND\xaeB`\x82' > /tmp/smoke-1px.png
UP=$(curl -s -b "$J" "${O[@]}" -F "file=@/tmp/smoke-1px.png;type=image/png" "$B/api/upload"); echo "$UP"
PID=$(echo "$UP" | sed -E 's/.*"id":"([^"]+)".*/\1/')
echo "$UP" | grep -q '"kind":"photo"' && ok "photo upload (magic-byte sniffed)" || no "photo upload" "$UP"
PU=$(curl -s -b "$J" "${O[@]}" -F "file=@$FX/sample.pdf;type=application/pdf" "$B/api/upload"); echo "$PU"
DID=$(echo "$PU" | sed -E 's/.*"id":"([^"]+)".*/\1/')
echo "$PU" | grep -q '"pages":2' && ok "PDF upload + text extraction" || no "pdf upload" "$PU"
printf '<html><script>alert(1)</script>' > /tmp/smoke-evil.png
[ "$(code -b "$J" "${O[@]}" -F "file=@/tmp/smoke-evil.png;type=image/png" "$B/api/upload")" = 415 ] && ok "HTML renamed .png rejected 415" || no "evil upload" x
H=$(curl -s -D - -o /dev/null -b "$J" "$B/api/media/$PID")
echo "$H" | grep -qi "x-content-type-options: nosniff" && echo "$H" | grep -qi "content-type: image/png" && ok "own media served with nosniff" || no "media headers" "$H"
curl -s -D - -o /dev/null -b "$J" "$B/api/media/$DID" | grep -qi "content-disposition: attachment" && ok "PDF always downloads (never inline)" || no "pdf disposition" x
[ "$(code -b "$J2" "$B/api/media/$PID")" = 404 ] && ok "other user's media -> 404" || no "IDOR media" x
[ "$(code -b "$J2" "${O[@]}" -H 'content-type: application/json' -d "{\"text\":\"what is this\",\"attachments\":[\"$PID\"]}" "$B/api/chat")" = 404 ] && ok "other user can't attach A's photo" || no "IDOR attach" x
[ "$(code "${O[@]}" -F "file=@/tmp/smoke-1px.png;type=image/png" "$B/api/upload")" = 401 ] && ok "upload needs login" || no "upload auth" x
R5=$(curl -s -b "$J" "${O[@]}" -H 'content-type: application/json' -d "{\"text\":\"what is the rent?\",\"attachments\":[\"$DID\"]}" "$B/api/chat")
echo "$R5" | grep -q '"type":"done"' && ok "chat with PDF attached" || no "chat pdf" "$R5"
R6=$(curl -s -b "$J" "${O[@]}" -H 'content-type: application/json' -d '{"text":"generate an image of a cat on a bike"}' "$B/api/chat")
echo "$R6" | grep -q '"intent":"image_gen"' && echo "$R6" | grep -q '"type":"done"' && ok "image request answers gracefully without keys" || no "image_gen mock" "$R6"
TC=$(code -b "$J" "${O[@]}" -F "audio=@$FX/audio/hello.webm;type=audio/webm" "$B/api/transcribe")
[ "$TC" = 503 ] || [ "$TC" = 200 ] && ok "transcribe answers ($TC)" || no "transcribe" "$TC"
[ "$(code -b "$J" "${O[@]}" -F "audio=@$FX/sample.pdf;type=text/html" "$B/api/transcribe")" != 200 ] && ok "transcribe rejects non-audio" || no "stt mime" x
CSP=$(curl -s -D - -o /dev/null -b "$J" "$B/" | grep -i "^content-security-policy")
echo "$CSP" | grep -q "'nonce-" && echo "$CSP" | grep -q "strict-dynamic" && ! echo "$CSP" | grep -q "script-src[^;]*unsafe-inline" && ok "page CSP uses per-request nonce" || no "csp nonce" "$CSP"
curl -s -D - -o /dev/null -b "$J" "$B/api/threads" | grep -qi "content-security-policy: default-src 'none'" && ok "API responses get default-src 'none'" || no "api csp" x
rm -f /tmp/smoke-1px.png /tmp/smoke-evil.png

echo "---- $pass passed, $fail failed"
rm -f "$J" "$J2"
[ "$fail" = 0 ]
