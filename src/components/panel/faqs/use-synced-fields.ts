import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";

import { syncFaqField } from "~/lib/admin/faq-field-sync";
import { faqField, type FaqPart, type FaqText } from "~/lib/admin/faqs";

const PARTS = ["question", "answer"] as const satisfies readonly FaqPart[];

type Field = HTMLInputElement | HTMLTextAreaElement;

interface BaseStore {
  readonly read: () => FaqText;
  readonly write: (next: FaqText) => void;
  readonly subscribe: (onChange: () => void) => () => void;
}

// La base depende de lo que hay escrito en los campos, que React no conoce:
// vive fuera de él y React la pinta cuando cambia.
function createBaseStore(initial: FaqText): BaseStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    read: () => current,
    write: (next) => {
      current = next;
      listeners.forEach((notify) => notify());
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
  };
}

function readSent(
  form: FormData | undefined,
  name: string,
): string | undefined {
  const value = form?.get(name);
  return typeof value === "string" ? value : undefined;
}

interface SyncedFieldsInput {
  readonly code: string;
  /** Lo guardado en ese idioma. */
  readonly stored: FaqText | undefined;
  /** La base con la que nace la pantalla. */
  readonly initialBase: FaqText;
  /** El envío en curso, si hay uno. */
  readonly submitted: FormData | undefined;
}

interface SyncedFields {
  /** Va en el elemento que contiene los campos. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
  /** El texto que el servidor debe tomar como visto por esta persona. */
  readonly base: FaqText;
}

/**
 * Cuando lo guardado de un idioma cambia, pone al día sus campos y la base que
 * le dice al servidor qué vio la persona (ver `syncFaqField`). Lo que ella
 * cambió se queda como está, con su foco.
 */
export function useSyncedFields({
  code,
  stored,
  initialBase,
  submitted,
}: SyncedFieldsInput): SyncedFields {
  const containerRef = useRef<HTMLDivElement>(null);
  const [store] = useState(() => createBaseStore(initialBase));
  const base = useSyncExternalStore(store.subscribe, store.read, store.read);
  const question = stored?.question ?? "";
  const answer = stored?.answer ?? "";
  // Lo guardado llega cuando el envío ya terminó: hay que recordarlo.
  const lastSent = useRef<FormData | undefined>(undefined);
  useEffect(() => {
    if (submitted !== undefined) lastSent.current = submitted;
  }, [submitted]);
  useEffect(() => {
    const next = { question, answer };
    const seen = { ...store.read() };
    for (const part of PARTS) {
      const name = faqField(part, code);
      const field = containerRef.current?.querySelector<Field>(
        `[name="${name}"]`,
      );
      if (!field) continue;
      const synced = syncFaqField(part, {
        visible: field.value,
        base: seen[part],
        stored: next[part],
        sent: readSent(lastSent.current, name),
      });
      // Escribir el mismo texto movería el cursor de quien está escribiendo.
      if (field.value !== synced.visible) field.value = synced.visible;
      seen[part] = synced.base;
    }
    if (PARTS.some((part) => seen[part] !== store.read()[part])) {
      store.write(seen);
    }
  }, [code, question, answer, store]);
  return { containerRef, base };
}
