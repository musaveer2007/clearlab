"use client";

/**
 * Extracts all text content from a PDF file in the browser.
 * Uses dynamic import to ensure pdfjs-dist only loads client-side.
 * Returns the concatenated text from all pages.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamic import to avoid SSR issues — pdfjs-dist requires browser APIs (DOMMatrix, canvas, etc.)
  const pdfjsLib = await import("pdfjs-dist");

  // Set the worker source to the CDN version matching our installed pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
