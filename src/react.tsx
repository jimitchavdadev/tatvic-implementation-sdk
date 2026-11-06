'use client';

import React, { useEffect } from 'react';
import { initFirstPartyWrapper } from './index.js';
import './custom-element.js';
import type { ProxySdkOptions } from './types.js';

export interface TatvicWrapperProps extends ProxySdkOptions {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Universal React & Next.js App Wrapper.
 *
 * Wrap your entire app once:
 *
 * ```tsx
 * import { TatvicWrapper } from 'tatvic-implementation-sdk';
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <TatvicWrapper>
 *       {children}
 *     </TatvicWrapper>
 *   );
 * }
 * ```
 */
export function TatvicWrapper({
  children,
  className,
  style,
  ...options
}: TatvicWrapperProps): React.JSX.Element {
  useEffect(() => {
    initFirstPartyWrapper(options);
  }, [options.proxyEndpoint, options.debug]);

  return React.createElement(
    'tatvic-wrapper',
    {
      class: className,
      style: { display: 'contents', ...style },
      endpoint: options.proxyEndpoint,
      debug: options.debug ? 'true' : undefined,
    },
    children
  );
}
