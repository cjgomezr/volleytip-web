import {
  APP_FORM_ERROR_KEYS,
  type AppFormErrors,
  type AppFormValues,
  type AppSettingsView,
} from "../admin/settings-view";
import {
  isStoreUrl,
  resolveAppAvailability,
  type AppAvailabilitySetting,
  type StoreUrlField,
} from "../app-availability.server";
import type { StoredSetting } from "./stored-setting.server";

function readText(source: unknown, field: string): string {
  if (typeof source !== "object" || source === null) return "";
  const value: unknown = (source as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

// Una forma válida que se contradice ("disponible" sin direcciones) también
// es inválida: la página `/app` sigue en lista de espera.
function describeState(
  stored: StoredSetting<AppAvailabilitySetting>,
): AppSettingsView["state"] {
  if (stored.kind === "missing") return "waitlist";
  if (stored.kind === "invalid") return "invalid";
  const { status } = stored.value;
  return resolveAppAvailability(stored.value).state === status
    ? status
    : "invalid";
}

/** El estado que pinta el panel y lo guardado en cada campo. */
export function describeAppSettings(
  stored: StoredSetting<AppAvailabilitySetting>,
): AppSettingsView {
  const raw = stored.kind === "missing" ? { status: "waitlist" } : stored.raw;
  return {
    state: describeState(stored),
    values: {
      status: readText(raw, "status"),
      appStoreUrl: readText(raw, "appStoreUrl"),
      playStoreUrl: readText(raw, "playStoreUrl"),
    },
  };
}

export function readAppForm(formData: FormData): AppFormValues {
  const read = (field: string): string => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };
  return {
    status: read("status"),
    appStoreUrl: read("appStoreUrl"),
    playStoreUrl: read("playStoreUrl"),
  };
}

export type AppFormReview =
  | { readonly isValid: true; readonly value: AppValue }
  | { readonly isValid: false; readonly errors: AppFormErrors };

// Un tipo y no la interfaz `AppAvailabilitySetting`: así cabe en una columna
// JSON.
type AppValue = {
  [Field in keyof AppAvailabilitySetting]: AppAvailabilitySetting[Field];
};

// En lista de espera un campo vacío no borra: conserva la dirección guardada
// que sirva. Una de las dos se quita guardando como disponible sin ella; la
// última no se quita desde el panel.
function chooseUrl(
  field: StoreUrlField,
  typed: string,
  status: AppAvailabilitySetting["status"],
  stored: StoredSetting<AppAvailabilitySetting>,
): string {
  if (typed !== "" || status === "available" || stored.kind === "missing") {
    return typed;
  }
  const saved = readText(stored.raw, field);
  return isStoreUrl(saved, field) ? saved : "";
}

function reviewUrls(
  urls: Readonly<Record<StoreUrlField, string>>,
): AppFormErrors {
  return Object.fromEntries(
    (["appStoreUrl", "playStoreUrl"] as const)
      .filter((field) => urls[field] !== "" && !isStoreUrl(urls[field], field))
      .map((field) => [field, APP_FORM_ERROR_KEYS[field]]),
  );
}

/** Valida un envío del estado de la app y arma el valor que se guarda. */
export function reviewAppForm(
  values: AppFormValues,
  stored: StoredSetting<AppAvailabilitySetting>,
): AppFormReview {
  const { status } = values;
  if (status !== "waitlist" && status !== "available") {
    return {
      isValid: false,
      errors: { status: APP_FORM_ERROR_KEYS.status },
    };
  }
  const urls = {
    appStoreUrl: chooseUrl(
      "appStoreUrl",
      values.appStoreUrl.trim(),
      status,
      stored,
    ),
    playStoreUrl: chooseUrl(
      "playStoreUrl",
      values.playStoreUrl.trim(),
      status,
      stored,
    ),
  };
  const errors = reviewUrls(urls);
  if (Object.keys(errors).length > 0) return { isValid: false, errors };
  const { appStoreUrl, playStoreUrl } = urls;
  if (status === "available" && appStoreUrl === "" && playStoreUrl === "") {
    return {
      isValid: false,
      errors: { appStoreUrl: APP_FORM_ERROR_KEYS.missingUrl },
    };
  }
  return {
    isValid: true,
    value: {
      status,
      ...(appStoreUrl === "" ? {} : { appStoreUrl }),
      ...(playStoreUrl === "" ? {} : { playStoreUrl }),
    },
  };
}
