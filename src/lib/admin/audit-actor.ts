/** El perfil de quien hizo una entrada de la bitácora. El correo es `citext`
 * en la base y el tipo generado no sabe qué es. */
export interface AuditActorProfile {
  readonly full_name: string | null;
  readonly email: unknown;
}

/** Cómo se llama en el panel: su nombre o, si no tiene, su correo. */
export function nameProfile({ full_name, email }: AuditActorProfile): string {
  return full_name?.trim() || String(email);
}

/** Quién hizo una entrada. `null` cuando no fue una persona: la pantalla dice
 * "Sistema". */
export function describeActor(actor: AuditActorProfile | null): string | null {
  return actor === null ? null : nameProfile(actor);
}
