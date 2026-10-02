/**
 * Root layout — sets page metadata and HTML structure.
 * Uses: public/style.css for global styles.
 */

import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreditWise AI - Financial & Loan Intelligence Platform",
  description: "AI-powered loan assistant platform for company verification, EMI calculations, and bank policy guidelines.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-bs-theme="light" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var theme = saved ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-bs-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
