import type { AuditActor } from "./audit-filters";

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

/** Las personas entre las que se filtra, en orden alfabético. A quienes
 * comparten nombre los distingue el correo. */
export function listFilterActors(
  profiles: readonly (AuditActorProfile & { readonly id: string })[],
): readonly AuditActor[] {
  const names = profiles.map(nameProfile);
  const isShared = (name: string): boolean =>
    names.indexOf(name) !== names.lastIndexOf(name);
  return profiles
    .map((profile) => {
      const name = nameProfile(profile);
      const label = isShared(name)
        ? `${name} (${String(profile.email)})`
        : name;
      return { id: profile.id, name: label };
    })
    .sort((first, second) => first.name.localeCompare(second.name, "es"));
}

/** Quién hizo una entrada. `null` cuando no fue una persona: la pantalla dice
 * "Sistema". */
export function describeActor(actor: AuditActorProfile | null): string | null {
  return actor === null ? null : nameProfile(actor);
}
