#!/usr/bin/env bash
# Comprueba que cada variable nombrada tenga valor y falla nombrando las que
# no. La usa .github/workflows/migrations.yml antes de tocar ninguna base: un
# secreto de GitHub que no existe llega como cadena vacía, sin ningún aviso.
#
#   bash scripts/check-required-secrets.sh NOMBRE_1 NOMBRE_2 ...
#
# Solo imprime nombres. Nunca imprime un valor.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Uso: bash scripts/check-required-secrets.sh NOMBRE [NOMBRE...]" >&2
  exit 2
fi

missing=()
for name in "$@"; do
  if [ -z "${!name:-}" ]; then
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  for name in "${missing[@]}"; do
    echo "::error::Falta el secreto ${name}. Se crea en GitHub: Settings, Secrets and variables, Actions. Qué valor lleva: docs/entornos.md." >&2
  done
  exit 1
fi

echo "Los $# secretos están puestos."
