import { data, type ActionFunctionArgs } from "react-router";

import {
  DIRECTION_FIELD,
  type FaqDirection,
  type FaqListOutcome,
  type FaqStatus,
} from "../admin/faqs";
import type { Json } from "../database.types";
import { isUuid } from "../is-uuid";
import { findBrokenRule } from "./database-rule.server";
import { reject, type SaveOutcome } from "./editor-input.server";
import { panelSessionContext } from "./panel-middleware.server";

// Los botones de la lista: publicar, retirar, subir y bajar. Cada uno es una
// función de la base, que decide con la fila bloqueada. No hay borrar.

const NOT_FOUND_STATUS = 404;
// `no_data_found`: las funciones lo lanzan si la pregunta no existe.
const MISSING_FAQ_CODE = "P0002";
const DEFAULT_TEXT_RULE = "faqs_published_default_text_check";

type StatusResult = SaveOutcome<FaqListOutcome, "status">;
type MoveResult = SaveOutcome<FaqListOutcome, "position">;

function readFaqId({ params }: ActionFunctionArgs): string {
  const id = params.faqId ?? "";
  if (!isUuid(id)) throw data(null, { status: NOT_FOUND_STATUS });
  return id;
}

function failChange(
  faqId: string,
  error: { code: string; message: string },
): never {
  if (error.code === MISSING_FAQ_CODE) {
    throw data(null, { status: NOT_FOUND_STATUS });
  }
  throw new Error(`No se pudo cambiar la pregunta ${faqId}: ${error.message}`, {
    cause: error,
  });
}

function unchanged(faqId: string): {
  result: FaqListOutcome;
  change: null;
} {
  return { result: { status: "unchanged", faqId }, change: null };
}

/** Publica o retira la pregunta de la dirección. */
export async function changeFaqStatus(
  args: ActionFunctionArgs,
  status: Exclude<FaqStatus, "draft">,
): Promise<StatusResult> {
  const faqId = readFaqId(args);
  const { client } = args.context.get(panelSessionContext);
  const { data: previous, error } = await client.rpc("set_faq_status", {
    p_faq_id: faqId,
    p_status: status,
  });
  if (error !== null) {
    if (findBrokenRule(error, [DEFAULT_TEXT_RULE])) {
      return reject<FaqListOutcome>({
        status: "invalid",
        faqId,
        error: "missingDefaultText",
      });
    }
    failChange(faqId, error);
  }
  // Nulo: otra persona ya lo cambió, o el cambio no aplica a su estado.
  if (!previous) return unchanged(faqId);
  return {
    result: { status, faqId },
    change: {
      entityId: faqId,
      before: { status: previous },
      after: { status },
    },
  };
}

function isMove(value: Json): value is { from: number; to: number } {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.from === "number" &&
    typeof value.to === "number"
  );
}

function readDirection(formData: FormData): FaqDirection | null {
  const value = formData.get(DIRECTION_FIELD);
  return value === "up" || value === "down" ? value : null;
}

/** Sube o baja un lugar la pregunta de la dirección. */
export async function moveFaq(args: ActionFunctionArgs): Promise<MoveResult> {
  const faqId = readFaqId(args);
  const direction = readDirection(await args.request.formData());
  if (direction === null) {
    return reject<FaqListOutcome>({
      status: "invalid",
      faqId,
      error: "malformed",
    });
  }
  const { client } = args.context.get(panelSessionContext);
  const { data: move, error } = await client.rpc("move_faq", {
    p_faq_id: faqId,
    p_direction: direction,
  });
  if (error !== null) failChange(faqId, error);
  // Nulo: ya estaba en el extremo.
  if (!isMove(move)) return unchanged(faqId);
  return {
    result: { status: "moved", faqId, direction, position: move.to },
    change: {
      entityId: faqId,
      before: { position: move.from },
      after: { position: move.to },
    },
  };
}
