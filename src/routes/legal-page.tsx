import type { ReactElement } from "react";

import { formatDate } from "~/lib/i18n/format";
import type { Language } from "~/lib/i18n/languages";
import { useTranslate } from "~/lib/i18n/translations-context";
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentId,
  type LegalDocumentStatus,
} from "~/lib/legal/legal-documents";
import type { LegalBlock } from "~/lib/legal/legal-text-types";
import { getLegalText } from "~/lib/legal/legal-texts";

// Las fechas de vigencia se declaran sin hora; se leen al mediodía de Colombia
// para que ninguna zona horaria las corra de día.
const COLOMBIA_NOON_SUFFIX = "T12:00:00-05:00";
// Meta en la página y no la cabecera de `indexing.server.ts`: depende del dato
// del documento, que el middleware de la raíz no conoce.
const NO_INDEX = "noindex";

export interface LegalPageData {
  readonly title: string;
  readonly description: string;
  readonly version: string;
  readonly effectiveFrom: string;
  readonly isProvisional: boolean;
  readonly blocks: readonly LegalBlock[];
}

/** Lo que la página necesita de un documento, en un idioma. El estado se
 * puede pasar aparte solo para probar los dos casos. */
export function buildLegalPageData(
  id: LegalDocumentId,
  language: Language,
  status: LegalDocumentStatus = LEGAL_DOCUMENTS[id].status,
): LegalPageData {
  const { title, description, blocks } = getLegalText(id, language);
  const { version, effectiveDate } = LEGAL_DOCUMENTS[id];
  return {
    title,
    description,
    version,
    effectiveFrom: formatDate(
      new Date(`${effectiveDate}${COLOMBIA_NOON_SUFFIX}`),
      language,
    ),
    isProvisional: status === "provisional",
    blocks,
  };
}

export function buildLegalMeta(
  data: LegalPageData,
): Array<{ title: string } | { name: string; content: string }> {
  return [
    { title: data.title },
    { name: "description", content: data.description },
    ...(data.isProvisional ? [{ name: "robots", content: NO_INDEX }] : []),
  ];
}

function Block({ block }: { readonly block: LegalBlock }): ReactElement {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="mt-10 font-display text-[28px] leading-[1] uppercase">
          {block.text}
        </h2>
      );
    case "paragraph":
      return <p className="mt-4">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-4 list-disc space-y-2 pl-6">
          {block.items.map((item, index) => (
            <li key={`${index}-${item}`}>{item}</li>
          ))}
        </ul>
      );
  }
}

/** El cuerpo de una página legal: título, versión, vigencia y texto. */
export function LegalPage({
  title,
  version,
  effectiveFrom,
  isProvisional,
  blocks,
}: LegalPageData): ReactElement {
  const translate = useTranslate();

  return (
    <section data-zone="light" className="bg-brand-mist text-brand-night">
      <div className="mx-auto max-w-[760px] px-6 pt-12 pb-24 text-[16px] leading-[1.6] break-words">
        <h1 className="font-display text-[44px] leading-[0.95] uppercase md:text-[64px]">
          {title}
        </h1>
        <p className="mt-4 text-[14px] text-ink-subtle">
          {translate("legal.version", { version })}
          {" · "}
          {translate("legal.effectiveFrom", { date: effectiveFrom })}
        </p>
        {isProvisional ? (
          <p
            role="note"
            className="mt-6 rounded-md bg-brand-lime p-4 font-bold text-brand-night"
          >
            {translate("legal.provisionalNotice")}
          </p>
        ) : null}
        {blocks.map((block, index) => (
          <Block key={`${block.type}-${index}`} block={block} />
        ))}
      </div>
    </section>
  );
}
