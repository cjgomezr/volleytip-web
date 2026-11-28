# La línea base visual: comparar y aceptar

La única línea base que decide es la de Linux
(`tests/ui.spec.ts-snapshots/*-linux.png`). La maneja
`.github/workflows/visual-baselines.yml`.

## Comparar

En cada PR que toque una ruta visual, el job `compare` corre la suite completa
de Playwright y no escribe nada. Si falla, sube el artefacto `visual-diff`
(dura 14 días) con las diferencias y con
`test-results/visual-report.json`, que dice qué pruebas fallaron.

## Aceptar

Cuando la diferencia es intencionada, una persona abre el artefacto, mira las
capturas y lanza el workflow sobre la rama del PR con la dirección de esa
corrida:

```bash
gh workflow run visual-baselines.yml --ref <rama> \
  -f reviewed_run_url=<url de la corrida fallida>
```

El resumen de la corrida lista la dirección revisada, el modo usado y cuántas
pruebas se regeneran.

### Modo corto

Es el normal: `accept` corre sólo las pruebas que fallaron en la corrida
revisada, con `--update-snapshots`, y el commit del bot trae sólo las capturas
agregadas o modificadas de esas pruebas.

- Si alguna sigue fallando al regenerar (axe, un desborde, un error), el job
  termina en rojo con "El fallo no era de píxeles" y no commitea nada, aunque
  otras capturas sí hayan cambiado.
- Si todas pasan y ninguna captura cambia, el fallo era pasajero: el job
  termina en verde sin commit y lo dice. Vuelve a correr `compare`.
- También entran las pruebas que quedaron sin correr en un proyecto que sí
  corrió. Las de un proyecto que no arrancó porque falló otro del que depende
  no entran: las comprueba el `compare` de confirmación.

### Suite completa

`accept` compara todo y, si falla, regenera todo (unos 50 minutos) cuando no
puede fiarse de la lista. El resumen dice el motivo:

- la dirección no es de una corrida de este workflow en este repositorio, o
  GitHub no la encuentra;
- la corrida no salió en rojo;
- corrió sobre otro commit que la cabeza de la rama (empujaste después de
  revisarla);
- el artefacto venció, no se subió o no trae el reporte;
- la corrida tuvo errores fuera de las pruebas, o el reporte no trae ninguna
  prueba fallida.

Si la corrida se relanzó, cuenta su último intento, aunque la dirección
nombre uno anterior (`/attempts/N`): mira el artefacto de ese.

El modo corto va con `--no-deps`. Aquí las dependencias entre proyectos sólo
ordenan la corrida. Un proyecto que dependa de otro que prepare algo (una
sesión guardada, por ejemplo) o que tenga `teardown` no puede usarlo tal cual.

## Confirmar

El commit lo empuja `github-actions[bot]`, así que el `compare` que dispara
queda en `action_required`. Hay que aprobarlo y esperar a que salga verde antes
de mergear.

Si el que quedó desajustado es `main` (el incidente que abre
`scripts/report-visual-incident.sh`), se acepta con `--ref main`.
