/**
 * Root layout — sets page metadata and HTML structure.
 * Uses: public/style.css for global styles.
 */

import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "CreditWise AI",
  description: "AI-powered loan assistant platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css" />
      </head>
      <body>
        {children}
        <Script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js" strategy="beforeInteractive" />
        <Script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
