"use client";

/**
 * Extracts all text content from a PDF file in the browser.
 * Uses dynamic import to ensure pdfjs-dist only loads client-side.
 * The worker is served from /public/pdf.worker.min.mjs as a static asset.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamic import to avoid SSR — pdfjs-dist requires browser APIs
  const pdfjsLib = await import("pdfjs-dist");

  // Use the worker served from /public (copied from node_modules during build)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const totalPages = pdf.numPages;
  const textParts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n\n");
}
