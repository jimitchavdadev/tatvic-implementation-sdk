import type { PatchContext } from './patch-fetch.js';

/**
 * Patches window.dataLayer to automatically redact Personally Identifiable Information (PII)
 * such as email addresses and phone numbers from all pushed objects and variables.
 */
export function patchDataLayer(ctx: PatchContext): PropertyDescriptor | undefined {
  if (typeof window === 'undefined' || !ctx.piiRedactor.isEnabled()) {
    return undefined;
  }

  const dataLayerKey = ctx.options.dataLayerName || 'dataLayer';
  const piiRedactor = ctx.piiRedactor;
  const matcher = ctx.matcher;

  let originalDataLayerDesc: PropertyDescriptor | undefined;
  try {
    originalDataLayerDesc = Object.getOwnPropertyDescriptor(window, dataLayerKey);
  } catch {}

  const patchArrayPush = (arr: any[]) => {
    if (!arr || typeof arr !== 'object') return;

    for (let i = 0; i < arr.length; i++) {
      arr[i] = piiRedactor.redactJsonObject(arr[i]);
    }

    let targetPush = typeof arr.push === 'function' ? arr.push.bind(arr) : Array.prototype.push.bind(arr);
    let isSanitizing = false;

    const wrapPush = (fn: Function) => {
      return function (this: any, ...args: any[]) {
        if (!isSanitizing) {
          isSanitizing = true;
          try {
            for (let i = 0; i < args.length; i++) {
              args[i] = piiRedactor.redactJsonObject(args[i]);
            }
            matcher.log(`Sanitized ${dataLayerKey}.push:`, args);
          } finally {
            isSanitizing = false;
          }
        }
        return fn.apply(this === arr ? arr : this, args);
      };
    };

    try {
      Object.defineProperty(arr, 'push', {
        get() {
          return wrapPush(targetPush);
        },
        set(newPushFn: any) {
          targetPush = typeof newPushFn === 'function' ? newPushFn : targetPush;
        },
        configurable: true,
        enumerable: false,
      });
    } catch {
      const prevPush = arr.push;
      arr.push = wrapPush(prevPush);
    }
  };

  let _dataLayer: any = (window as any)[dataLayerKey];
  if (Array.isArray(_dataLayer)) {
    patchArrayPush(_dataLayer);
  } else if (_dataLayer === undefined) {
    _dataLayer = [];
    patchArrayPush(_dataLayer);
  }

  try {
    Object.defineProperty(window, dataLayerKey, {
      get() {
        return _dataLayer;
      },
      set(newVal: any) {
        if (Array.isArray(newVal)) {
          patchArrayPush(newVal);
        }
        _dataLayer = newVal;
      },
      configurable: true,
      enumerable: true,
    });
  } catch {
    (window as any)[dataLayerKey] = _dataLayer;
  }

  matcher.log(`First-party dataLayer PII protection active on window.${dataLayerKey}`);
  return originalDataLayerDesc;
}
