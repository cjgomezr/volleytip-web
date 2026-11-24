/** Lo que el `action` de la home le devuelve al formulario "Avísame". */
export type CampNotifyOutcome =
  | { readonly status: "joined" }
  | {
      readonly status: "invalid";
      readonly fieldErrors: Readonly<Record<string, string>>;
      readonly values: Readonly<Record<string, string>>;
    }
  | { readonly status: "rejected"; readonly message: string };
