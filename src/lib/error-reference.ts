import { createContext, useContext } from "react";

// El código de referencia de un error del servidor: lo que la persona lee en
// la página 500 y lo que el registro guarda junto al error. React Router
// reemplaza el error por uno genérico antes de pintar la página, así que el
// código no puede viajar en el error: lo entrega `entry.server.tsx` por este
// contexto. Es una función y no un valor porque un error al pintar ocurre
// después de que el contexto ya se entregó.
// En el navegador no hay proveedor, y no hay código que mostrar.
export const ReferenceCodeContext = createContext<() => string | undefined>(
  () => undefined,
);

/** El código del error de esta petición, o `undefined` si no hay. */
export function useReferenceCode(): string | undefined {
  return useContext(ReferenceCodeContext)();
}
