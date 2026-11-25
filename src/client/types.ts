import type { BotUtmParams } from '../types.js';

export interface TatvicXhrMetadata {
  isProxied?: boolean;
  isBypassedBot?: boolean;
  originalUrl?: string;
  headerName?: string;
  headerValue?: string;
  previewToken?: string;
  botUtm?: BotUtmParams;
}

declare global {
  interface XMLHttpRequest {
    __tatvicMeta?: TatvicXhrMetadata;
  }
}
