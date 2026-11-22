export type IntegrationMode = "run" | "skip";

const RUN_FLAG = "1";

/**
 * Decide si las pruebas de integración corren, a partir del valor de
 * `RUN_INTEGRATION_TESTS`. Sin valor (o vacío, que es lo que manda `checks`
 * en un PR de solo texto) se saltan. Cualquier otro valor distinto de "1" es
 * un error de quien lo escribió: adivinar aquí dejaría un check en verde sin
 * haber corrido nada.
 */
export function resolveIntegrationMode(
  flag: string | undefined,
): IntegrationMode {
  if (flag === undefined || flag === "") {
    return "skip";
  }
  if (flag === RUN_FLAG) {
    return "run";
  }
  throw new Error(
    `RUN_INTEGRATION_TESTS vale ${JSON.stringify(flag)}. Usa "1" para correr las pruebas de integración o no la definas para saltarlas.`,
  );
}

/**
 * Dice si los archivos de prueba pueden correr a la vez. Con la base
 * encendida no: todos los de integración escriben en la misma, y en paralelo
 * uno ve las filas de prueba de otro. Sin base se saltan, así que no hay nada
 * que se pise y la corrida conserva su velocidad.
 */
export function allowsParallelFiles(mode: IntegrationMode): boolean {
  return mode === "skip";
}
