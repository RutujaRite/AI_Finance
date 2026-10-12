/**
 * Client-side Amortization PDF Generator & Downloader
 * Uses dynamic imports for html2canvas and jsPDF to ensure zero SSR crashes during Next.js server pre-rendering.
 */

export interface GeneratePdfOptions {
  fileName?: string;
  applicantName?: string;
  onProgress?: (progressText: string) => void;
}

export async function downloadAmortizationPdfFromElement(
  container: HTMLElement,
  options: GeneratePdfOptions = {}
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('PDF download can only be invoked in a browser environment.');
  }

  const pages = Array.from(container.querySelectorAll<HTMLElement>('.pdf-page'));
  if (!pages || pages.length === 0) {
    throw new Error('No PDF pages found in container element.');
  }

  if (options.onProgress) {
    options.onProgress('Loading PDF modules...');
  }

  // Dynamically import jsPDF and html2canvas so they never evaluate on the server
  const jspdfModule = await import('jspdf');
  const jsPDF = jspdfModule.jsPDF || (jspdfModule as any).default || jspdfModule;
  const html2canvasModule = await import('html2canvas');
  const html2canvas = html2canvasModule.default || html2canvasModule;

  const totalPages = pages.length;
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  for (let i = 0; i < totalPages; i++) {
    const pageEl = pages[i];
    if (options.onProgress) {
      options.onProgress(`Rendering page ${i + 1} of ${totalPages}...`);
    }

    // High resolution render (scale 2 = 300 DPI equivalent)
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  if (options.onProgress) {
    options.onProgress('Saving PDF...');
  }

  const sanitizedName = (options.applicantName || 'Loan_Assessment')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .trim();
  const fileName = options.fileName || `${sanitizedName}_Amortization_Statement.pdf`;

  pdf.save(fileName);
}
