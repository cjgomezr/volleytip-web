#!/usr/bin/env bash
# Averigua qué pruebas fallaron en la corrida de `compare` que alguien revisó,
# para que `accept` (.github/workflows/visual-baselines.yml) regenere sólo esas.
#
# Su lista sólo vale si la corrida es de este workflow, salió en rojo, corrió
# sobre el mismo commit que HEAD y su artefacto `visual-diff` sigue ahí. Ante
# cualquier duda no entrega lista, dice por qué en el resumen y `accept`
# regenera con la suite completa. Por eso sale siempre con 0.
#
# La lista sale del reporte JSON de `compare` y no de `.last-run.json`: ese
# archivo es oculto (upload-artifact no lo sube) y además cuenta como fallidas
# las pruebas que no llegaron a correr porque falló un proyecto del que
# dependen. Entran las que fallaron y las que quedaron sin correr en un
# proyecto que sí corrió (un grupo en serie, un `beforeAll` roto).
#
# Variables:
#   REVIEWED_RUN_URL  la dirección que escribió quien lanzó el workflow
#   GH_REPO           dueño/repositorio
#   FAILED_LIST_FILE  dónde dejar la lista, en el formato de --last-failed-file
#
# En GITHUB_OUTPUT deja `failed_list=<archivo>`, o vacío para la suite
# completa.

set -uo pipefail

: "${GH_REPO:?falta GH_REPO}"
: "${FAILED_LIST_FILE:?falta FAILED_LIST_FILE}"
url="${REVIEWED_RUN_URL:-}"

WORKFLOW_PATH=".github/workflows/visual-baselines.yml"
ARTIFACT="visual-diff"
REPORT_NAME="visual-report.json"

# Los ids de las pruebas por regenerar, uno por línea.
FAILED_IDS_FILTER='
  [ .suites[] | recurse(.suites[]?) | .specs[]? | .id as $id | .tests[]
    | { id: $id, project: .projectName, status, expectedStatus,
        ran: any(.results[]; .status != "skipped") } ] as $tests
  | ($tests | map(select(.ran) | .project) | unique) as $projects_that_ran
  | if any($tests[]; .status == "unexpected") then
      $tests[]
      | select(.status == "unexpected"
          or (.status == "skipped" and .expectedStatus != "skipped"
              and (.project | IN($projects_that_ran[]))))
      | .id
    else empty end
'

summarize() {
  echo "$1" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
}

set_failed_list() {
  echo "failed_list=$1" >>"${GITHUB_OUTPUT:-/dev/null}"
}

use_full_suite() {
  summarize "- Modo: suite completa ($1)"
  summarize "- Pruebas que se regeneran: toda la suite"
  set_failed_list ""
  exit 0
}

summarize "Línea base aceptada tras revisar: $url"
summarize ""

run_url_pattern='^https://github\.com/([^/]+/[^/]+)/actions/runs/([0-9]+)(/(attempts|job)/[0-9]+)?/?([?#].*)?$'
if ! [[ "$url" =~ $run_url_pattern ]] ||
  [ "${BASH_REMATCH[1],,}" != "${GH_REPO,,}" ]; then
  use_full_suite "la dirección no es de una corrida de este repositorio"
fi
run_id="${BASH_REMATCH[2]}"

if ! run=$(gh api "repos/$GH_REPO/actions/runs/$run_id" \
  --jq '[.path, .conclusion // "sin terminar", .head_sha] | @tsv'); then
  use_full_suite "no pude consultar la corrida $run_id"
fi
IFS=$'\t' read -r path conclusion head_sha <<<"${run%$'\r'}"

if [ "${path%%@*}" != "$WORKFLOW_PATH" ]; then
  use_full_suite "la corrida no es de este workflow, sino de ${path%%@*}"
fi
if [ "$conclusion" != "failure" ]; then
  use_full_suite "la corrida no salió en rojo: $conclusion"
fi
current_sha=$(git rev-parse HEAD)
if [ "$head_sha" != "$current_sha" ]; then
  use_full_suite "la corrida es de otro commit: $head_sha, y la rama va en $current_sha"
fi

# Carpeta nueva y vacía: lo que baja del artefacto sólo se lee como datos.
download_dir=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/visual-diff.XXXXXX")
if ! gh run download "$run_id" -n "$ARTIFACT" -D "$download_dir"; then
  use_full_suite "no pude bajar el artefacto $ARTIFACT: venció o no se subió"
fi
report=$(find "$download_dir" -type f -name "$REPORT_NAME" | head -n 1)
if [ -z "$report" ]; then
  use_full_suite "el artefacto $ARTIFACT no trae $REPORT_NAME"
fi

if ! error_count=$(jq '.errors | length' "$report") ||
  ! failed_ids=$(jq -r "$FAILED_IDS_FILTER" "$report"); then
  use_full_suite "el reporte de la corrida no se puede leer"
fi
if [ "${error_count%$'\r'}" != "0" ]; then
  use_full_suite "la corrida tuvo errores fuera de las pruebas"
fi
failed_ids=$(printf '%s' "$failed_ids" | tr -d '\r')
if [ -z "$failed_ids" ]; then
  use_full_suite "el reporte no trae ninguna prueba fallida"
fi

if ! printf '%s\n' "$failed_ids" |
  jq -R . | jq -s '{status: "failed", failedTests: .}' >"$FAILED_LIST_FILE"; then
  use_full_suite "no pude escribir la lista de fallos"
fi

summarize "- Modo: corto (sólo lo que falló en esa corrida)"
summarize "- Pruebas que se regeneran: $(printf '%s\n' "$failed_ids" | wc -l | tr -d ' ')"
set_failed_list "$FAILED_LIST_FILE"
