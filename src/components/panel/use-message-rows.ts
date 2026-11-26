import { useEffect, useRef, useState, type RefObject } from "react";

import type { LocalizedDraft } from "~/lib/admin/site-texts";
import type { Language } from "~/lib/i18n/languages";

import type { MessageRow, RowAction } from "./announcement-message-fields";

/** Lo último que pasó con la lista, para anunciarlo. */
export interface ListChange {
  readonly kind: "moved" | "removed";
  /** La posición, desde 1: donde quedó o la que se quitó. */
  readonly number: number;
}

export interface MessageRows {
  readonly rows: readonly MessageRow[];
  /** Donde viven los campos: ahí se busca a quién darle el foco. */
  readonly listRef: RefObject<HTMLDivElement | null>;
  readonly lastChange: ListChange | null;
  readonly add: () => void;
  readonly edit: (id: number, language: Language, text: string) => void;
  readonly apply: (position: number, action: RowAction) => void;
}

const ADD_BUTTON = "[data-add-message] button";

function rowControl(id: number, action: "up" | "down"): string {
  return `[data-message-row="${id}"] [data-row-action="${action}"] button:not(:disabled)`;
}

function firstField(id: number): string {
  return `[data-message-row="${id}"] input`;
}

// Al reordenar o quitar, el botón que tenía el foco se mueve, se deshabilita
// o desaparece: quien usa el teclado quedaría sin saber dónde está.
function useDeferredFocus(
  listRef: RefObject<HTMLDivElement | null>,
  rows: readonly MessageRow[],
): (selectors: readonly string[]) => void {
  const wanted = useRef<readonly string[]>([]);
  useEffect(() => {
    for (const selector of wanted.current) {
      const target = listRef.current?.querySelector<HTMLElement>(selector);
      if (target) {
        target.focus();
        break;
      }
    }
    wanted.current = [];
  }, [listRef, rows]);
  return (selectors) => {
    wanted.current = selectors;
  };
}

function swap(
  rows: readonly MessageRow[],
  from: number,
  to: number,
): readonly MessageRow[] {
  return rows.map((row, position) => {
    if (position === from) return rows[to] ?? row;
    if (position === to) return rows[from] ?? row;
    return row;
  });
}

/** Los mensajes de la barra mientras se editan: agregar, quitar y reordenar
 * antes de guardar. */
export function useMessageRows(
  initial: readonly LocalizedDraft[],
): MessageRows {
  const [rows, setRows] = useState<readonly MessageRow[]>(() =>
    initial.map((draft, id) => ({ ...draft, id })),
  );
  const [lastChange, setLastChange] = useState<ListChange | null>(null);
  const nextId = useRef(initial.length);
  const listRef = useRef<HTMLDivElement>(null);
  const focusAfterRender = useDeferredFocus(listRef, rows);

  function add(): void {
    const id = nextId.current;
    nextId.current += 1;
    focusAfterRender([firstField(id)]);
    setLastChange(null);
    setRows([...rows, { id, es: "", en: "" }]);
  }

  function edit(id: number, language: Language, text: string): void {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [language]: text } : row,
      ),
    );
  }

  function remove(position: number): void {
    const left = rows.filter((_row, index) => index !== position);
    const neighbor = left[position] ?? left[position - 1];
    focusAfterRender(neighbor ? [firstField(neighbor.id)] : [ADD_BUTTON]);
    setLastChange({ kind: "removed", number: position + 1 });
    setRows(left);
  }

  function apply(position: number, action: RowAction): void {
    if (action === "remove") {
      remove(position);
      return;
    }
    const target = action === "up" ? position - 1 : position + 1;
    const moved = rows[position];
    if (moved === undefined || rows[target] === undefined) return;
    const opposite = action === "up" ? "down" : "up";
    focusAfterRender([
      rowControl(moved.id, action),
      rowControl(moved.id, opposite),
    ]);
    setLastChange({ kind: "moved", number: target + 1 });
    setRows(swap(rows, position, target));
  }

  return { rows, listRef, lastChange, add, edit, apply };
}
