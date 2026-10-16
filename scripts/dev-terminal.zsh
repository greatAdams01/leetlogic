#!/bin/zsh
# Run a project service in a visible terminal and retain a private local log.
set -eu
cd -- "${0:A:h}/.."
service="${1:-}"
case "$service" in
  api) service_command=(pnpm --filter @leetlogic/api dev) ;;
  mobile) service_command=(pnpm --filter @leetlogic/mobile start --port 8082) ;;
  web) service_command=(pnpm --filter @leetlogic/web dev) ;;
  postgres|redis|adminer) service_command=(docker compose logs --follow --tail 50 --no-color "$service") ;;
  *) print -u2 'Choose api, mobile, web, postgres, redis or adminer'; exit 2 ;;
esac
umask 077
mkdir -p .local/logs
log_file="$PWD/.local/logs/$service.log"
touch "$log_file"
chmod 600 "$log_file"
print -Pn "\e]0;LeetLogic · $service logs\a"
print "LeetLogic · $service"
print "Live output is also saved to $log_file"
print 'Press Ctrl+C to stop this stream. For API/Metro/web, this also stops that server.'
# macOS script keeps a PTY so Metro QR codes and keyboard shortcuts work normally.
exec /usr/bin/script -aq "$log_file" "${service_command[@]}"
