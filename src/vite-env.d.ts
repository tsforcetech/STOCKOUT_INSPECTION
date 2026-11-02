/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
  readonly VITE_REFRESH_TOKEN_STORAGE?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_MARKETPLACE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
