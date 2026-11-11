import React from 'react';
import { TatvicWrapper } from '../../../src/react.js';

export const metadata = {
  title: 'Next.js App Router GTM Demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* GTM Snippet */}
        <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-T32XGF8F" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
            `,
          }}
        />
      </head>
      <body>
        {/* The Single Simple Wrapper */}
        <TatvicWrapper>
          {children}
        </TatvicWrapper>
      </body>
    </html>
  );
}
