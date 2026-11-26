import { data, redirect, type ActionFunctionArgs } from "react-router";

import {
  NOTICE_PARAM,
  type MessageNotice,
  type MessageStatus,
} from "../admin/messages";
import type { Database } from "../database.types";
import { getRequestLanguage } from "../i18n/languages";
import type { TypedSupabaseClient } from "../supabase/typed-client";
import type { AdminActionOutcome } from "./admin-action.server";
import { isMessageId } from "./messages-inbox.server";
import { buildMessagePath } from "./messages-view.server";
import {
  panelMemberContext,
  panelSessionContext,
} from "./panel-middleware.server";

// Los cambios de estado de un mensaje. La base solo deja a un admin cambiar
// `status`, `answered_by` y `answered_at`: lo que escribió la persona no se
// toca y no se borra.

const SEE_OTHER = 303;
const NOT_FOUND_STATUS = 404;

export type MessageTransition = "answer" | "archive" | "reopen";

type MessageUpdate = Database["public"]["Tables"]["messages"]["Update"] & {
  readonly status: MessageStatus;
};

interface CurrentState {
  readonly status: MessageStatus;
  readonly answered_at: string | null;
}

interface TransitionRule {
  readonly notice: MessageNotice;
  /** Lo que se escribe, o `null` si no aplica al estado actual. */
  readonly plan: (
    current: CurrentState,
    memberId: string,
  ) => MessageUpdate | null;
}

const TRANSITIONS: Readonly<Record<MessageTransition, TransitionRule>> = {
  answer: {
    notice: "answered",
    plan: ({ status }, memberId) =>
      status === "new"
        ? {
            status: "answered",
            answered_by: memberId,
            answered_at: new Date().toISOString(),
          }
        : null,
  },
  // Archivar conserva quién respondió: reabrir vuelve a donde estaba.
  archive: {
    notice: "archived",
    plan: ({ status }) =>
      status === "archived" ? null : { status: "archived" },
  },
  reopen: {
    notice: "reopened",
    plan: ({ status, answered_at: answeredAt }) =>
      status === "archived"
        ? { status: answeredAt === null ? "new" : "answered" }
        : null,
  },
};

async function readState(
  client: TypedSupabaseClient,
  id: string,
): Promise<CurrentState | null> {
  if (!isMessageId(id)) return null;
  const { data: rows, error } = await client
    .from("messages")
    .select("status, answered_at")
    .eq("id", id);
  if (error !== null) {
    throw new Error(`No se pudo leer el mensaje ${id}: ${error.message}`, {
      cause: error,
    });
  }
  return rows[0] ?? null;
}

interface StatusWrite {
  readonly client: TypedSupabaseClient;
  readonly id: string;
  /** Lo que se leyó, y con lo que se decidió el cambio. */
  readonly previous: CurrentState;
  readonly update: MessageUpdate;
}

function isSameState(first: CurrentState, second: CurrentState): boolean {
  return (
    first.status === second.status && first.answered_at === second.answered_at
  );
}

/** Escribe solo si el mensaje sigue como se leyó: así el "antes" de la
 * bitácora es el que de verdad se cambió, y reabrir no decide con una
 * respuesta vieja. Devuelve `false` si otra persona lo cambió en medio, y
 * lanza si la base no lo guardó. */
async function writeStatus({
  client,
  id,
  previous,
  update,
}: StatusWrite): Promise<boolean> {
  const sameStatus = client
    .from("messages")
    .update(update)
    .eq("id", id)
    .eq("status", previous.status);
  const { data: rows, error } = await (
    previous.answered_at === null
      ? sameStatus.is("answered_at", null)
      : sameStatus.eq("answered_at", previous.answered_at)
  ).select("id");
  if (error !== null) {
    throw new Error(`No se pudo cambiar el mensaje ${id}: ${error.message}`, {
      cause: error,
    });
  }
  if (rows.length > 0) return true;
  const current = await readState(client, id);
  if (current === null || !isSameState(current, previous)) return false;
  throw new Error(
    `No se pudo cambiar el mensaje ${id}: la base no cambió ninguna fila`,
  );
}

/**
 * Aplica un cambio de estado al mensaje de la dirección y vuelve a su
 * detalle. Es el `run` de las acciones de `message.*`. Responde 404 si el
 * mensaje no existe.
 */
export async function changeMessageStatus(
  { request, context, params }: ActionFunctionArgs,
  transition: MessageTransition,
): Promise<AdminActionOutcome<Response, "status">> {
  const { client } = context.get(panelSessionContext);
  const id = params.messageId ?? "";
  const current = await readState(client, id);
  if (current === null) throw data(null, { status: NOT_FOUND_STATUS });
  const { notice, plan } = TRANSITIONS[transition];
  const update = plan(current, context.get(panelMemberContext).id);
  const isChanged =
    update !== null &&
    (await writeStatus({ client, id, previous: current, update }));
  const path = buildMessagePath(id, getRequestLanguage(request));
  return {
    result: redirect(
      `${path}?${NOTICE_PARAM}=${isChanged ? notice : "unchanged"}`,
      SEE_OTHER,
    ),
    change:
      update !== null && isChanged
        ? {
            entityId: id,
            before: { status: current.status },
            after: { status: update.status },
          }
        : null,
  };
}
