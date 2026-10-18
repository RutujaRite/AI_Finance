/**
 * Root layout — sets page metadata and HTML structure.
 * Uses: public/style.css for global styles.
 */

import type { Metadata } from "next";
import Script from "next/script";
import { cookies } from "next/headers";
import "./globals.css";
import RouteLoaderWrapper from "@/components/RouteLoaderWrapper";

export const metadata: Metadata = {
  title: "CreditWise AI | Predict Best Loan Offers in India • 99% Confirmed Match",
  description: "Predict which Indian bank can give you the best loan offer with lowest interest rates. Free EMI calculator in INR (₹), 99% accurate loan predictions, CIBIL eligibility simulator, and public corporate tiers for SBI, HDFC, ICICI, Axis, Kotak & more.",
  keywords: [
    "predict best loan offer",
    "which bank gives best loan in india",
    "personal loan eligibility predictor india",
    "cibil score loan approval prediction",
    "emi calculator inr",
    "compare indian bank loan rates",
    "sbi loan prediction",
    "hdfc personal loan interest rate 2026",
    "icici personal loan eligibility",
    "company category list sbi hdfc icici",
    "loan prediction 99 percent confirmed",
    "indian banks loan comparison"
  ],
  authors: [{ name: "InCraax AI Automation" }],
  creator: "CreditWise AI",
  publisher: "InCraax AI",
  robots: "index, follow",
  openGraph: {
    title: "CreditWise AI - Predict Which Indian Bank Gives You The Best Loan Offer",
    description: "AI-powered loan predictions with up to 99% confirmed alignment. Free INR EMI calculations and public Indian bank benchmark comparisons with zero credit pull.",
    locale: "en_IN",
    type: "website",
    siteName: "CreditWise AI India",
  },
  twitter: {
    card: "summary_large_image",
    title: "CreditWise AI - Predict Best Indian Bank Loan Offers",
    description: "99% confirmed loan predictions using publicly benchmarked Indian banking criteria. Compare rates, calculate EMIs in INR.",
  },
  alternates: {
    canonical: "/",
  },
};

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://creditwise.ai/#website",
      "url": "https://creditwise.ai",
      "name": "CreditWise AI India",
      "description": "AI-powered financial guidance and loan offer prediction portal for Indian borrowers.",
      "inLanguage": "en-IN"
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://creditwise.ai/#software",
      "name": "CreditWise AI Loan Offer Predictor",
      "applicationCategory": "FinanceApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "INR"
      },
      "featureList": [
        "Predict which bank gives the best loan offer with 99% accuracy",
        "Interactive EMI Calculator in INR",
        "Corporate employer risk tier classification",
        "Public Indian bank benchmark comparisons"
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://creditwise.ai/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How does CreditWise AI predict which bank will give the best loan offer?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "CreditWise AI uses predictive AI models trained on publicly accessible lending criteria, corporate employer risk tiers, and FOIR guidelines to forecast loan approval odds with up to 99% prediction accuracy across leading Indian banks."
          }
        },
        {
          "@type": "Question",
          "name": "Does CreditWise AI obtain information directly from banks?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. CreditWise AI is an independent public guidance engine. All estimates are predictions based on publicly available financial benchmarks, historic lending criteria, and mathematical models. The platform does not claim private data feeds from banks or direct banking affiliation."
          }
        },
        {
          "@type": "Question",
          "name": "What minimum CIBIL score is required for personal loans in India?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Most leading Indian banks require a minimum CIBIL score of 680 to 700 for loan pre-screening, while prime interest rates (starting from 8.35% - 8.45%) are generally predicted for applicants with scores of 750 and above."
          }
        },
        {
          "@type": "Question",
          "name": "How does company categorization affect personal loan interest rates in India?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Indian lenders classify employers into categories such as Super CAT-A, CAT-A, and CAT-B. Employees at Super CAT-A companies receive predicted rate concessions up to 0.35% and higher salary loan multipliers up to 30x monthly income."
          }
        },
        {
          "@type": "Question",
          "name": "Is there any hard credit check or fee to calculate EMI and check eligibility?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. All EMI calculations in INR and eligibility predictions on CreditWise AI are 100% free with zero credit score impact and no hard credit pull."
          }
        }
      ]
    }
  ]
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      data-bs-theme={initialTheme}
      data-theme={initialTheme}
      className={initialTheme === "dark" ? "dark" : ""}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme') || localStorage.getItem('finai-theme');
                  if (!saved) {
                    var m = document.cookie.match(/(?:^|; )theme=([^;]*)/);
                    if (m) saved = decodeURIComponent(m[1]);
                  }
                  var t = (saved === 'dark') ? 'dark' : (saved === 'light' ? 'light' : null);
                  if (!t) {
                    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-bs-theme', t);
                  document.documentElement.setAttribute('data-theme', t);
                  if (t === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen antialiased font-sans">
        {children}
        <RouteLoaderWrapper />
        <Script src="https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js" strategy="lazyOnload" />
        <Script src="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/highlight.min.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
