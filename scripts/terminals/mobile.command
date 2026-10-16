#!/bin/zsh
set -eu
exec /bin/zsh "${0:A:h}/../dev-terminal.zsh" "${0:t:r}"
