// Lo que las pantallas de ajustes reciben del servidor. Sin importar módulos
// de servidor: los componentes también lo usan.

import type { MessageKey } from "../i18n/translate";

export type MaintenanceSettingsState = "on" | "off" | "invalid";

export type AppSettingsState = "waitlist" | "available" | "invalid";

/** Lo que trae cada campo del formulario del estado de la app. */
export interface AppFormValues {
  readonly status: string;
  readonly appStoreUrl: string;
  readonly playStoreUrl: string;
}

export type AppFormField = keyof AppFormValues;

/** Los errores del formulario, como claves de traducción. */
export const APP_FORM_ERROR_KEYS = {
  status: "panel.settings.app.error.status",
  missingUrl: "panel.settings.app.error.missingUrl",
  appStoreUrl: "panel.settings.app.error.appStoreUrl",
  playStoreUrl: "panel.settings.app.error.playStoreUrl",
} as const satisfies Readonly<Record<string, MessageKey>>;

export type AppFormErrors = Partial<Readonly<Record<AppFormField, MessageKey>>>;

/** Un envío del estado de la app que no se guardó. */
export interface AppFormRejection {
  readonly errors: AppFormErrors;
  readonly values: AppFormValues;
}

export interface AppSettingsView {
  readonly state: AppSettingsState;
  /** Lo guardado, aunque sea inválido: así se puede corregir. */
  readonly values: AppFormValues;
}

/** El parámetro de la dirección que dice qué se acaba de guardar. */
export const SAVED_PARAM = "saved";

export type SavedSetting = "maintenance" | "app";

export interface SettingsView {
  readonly maintenance: MaintenanceSettingsState;
  readonly app: AppSettingsView;
  readonly saved: SavedSetting | null;
}
