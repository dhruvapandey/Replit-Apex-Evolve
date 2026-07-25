/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPPORT_ENABLED?: string;
  readonly VITE_STRIPE_DONATION_URL?: string;
  readonly VITE_UPI_ID?: string;
  readonly VITE_UPI_PAYEE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
