"use client";

import { useEffect, useState } from "react";
import { AlertCircleIcon, CheckCircleIcon, ShieldCheckIcon } from "@/components/icons";

const TESSERACT_SCRIPT = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
const TESSERACT_WORKER = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js";
const TESSERACT_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0";
const TESSERACT_LANGUAGE = "https://tessdata.projectnaptha.com/4.0.0";
const PDF_SCRIPT = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.min.mjs";
const PDF_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs";
const PDF_EVENT = "edutrust:pdfjs-ready";
const MAX_PDF_PAGES = 3;

type Finding = {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

type Review = {
  verdict: "ready" | "review" | "high-risk";
  confidence: number;
  summary: string;
  extractedFields: {
    institution: string | null;
    recipient: string | null;
    qualification: string | null;
    issueDate: string | null;
    credentialId: string | null;
  };
  findings: Finding[];
  pagesReviewed: number;
  textLength: number;
};

type OcrWorker = {
  recognize: (source: File | HTMLCanvasElement) => Promise<{
    data: { text: string; confidence: number };
  }>;
  terminate: () => Promise<void>;
};

type TesseractApi = {
  createWorker: (
    languages: string,
    oem: number,
    options: {
      workerPath: string;
      corePath: string;
      langPath: string;
      logger: (message: { status?: string; progress?: number }) => void;
    },
  ) => Promise<OcrWorker>;
};

type PdfPage = {
  getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
    canvas: HTMLCanvasElement;
  }) => { promise: Promise<void> };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy?: () => Promise<void>;
};

type PdfJsApi = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: Uint8Array }) => { promise: Promise<PdfDocument> };
};

declare global {
  interface Window {
    Tesseract?: TesseractApi;
    __edutrustPdfJs?: PdfJsApi;
  }
}

let tesseractPromise: Promise<TesseractApi> | null = null;
let pdfPromise: Promise<PdfJsApi> | null = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractPromise) return tesseractPromise;

  tesseractPromise = new Promise<TesseractApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TESSERACT_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");
    const loaded = () => window.Tesseract
      ? resolve(window.Tesseract)
      : reject(new Error("The local OCR engine did not initialise."));
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", () => reject(new Error("The local OCR engine could not be downloaded.")), { once: true });
    if (!existing) {
      script.src = TESSERACT_SCRIPT;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });

  return tesseractPromise;
}

function loadPdfJs() {
  if (window.__edutrustPdfJs) return Promise.resolve(window.__edutrustPdfJs);
  if (pdfPromise) return pdfPromise;

  pdfPromise = new Promise<PdfJsApi>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("The private PDF reader did not initialise."));
    }, 20_000);
    const ready = () => {
      window.clearTimeout(timeout);
      window.removeEventListener(PDF_EVENT, ready);
      if (!window.__edutrustPdfJs) {
        reject(new Error("The private PDF reader did not initialise."));
        return;
      }
      window.__edutrustPdfJs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
      resolve(window.__edutrustPdfJs);
    };
    window.addEventListener(PDF_EVENT, ready);

    if (!document.getElementById("edutrust-pdfjs")) {
      const script = document.createElement("script");
      script.id = "edutrust-pdfjs";
      script.type = "module";
      script.textContent = `import * as pdfjs from "${PDF_SCRIPT}"; window.__edutrustPdfJs = pdfjs; window.dispatchEvent(new Event("${PDF_EVENT}"));`;
      document.head.appendChild(script);
    }
  });

  return pdfPromise;
}

function cleanLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function firstMatchingLine(lines: string[], pattern: RegExp) {
  return lines.find((line) => pattern.test(line) && line.length < 140) ?? null;
}

function afterLabel(lines: string[], pattern: RegExp) {
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) return null;
  const labelled = lines[index].replace(pattern, "").replace(/^[:\s-]+/, "").trim();
  return labelled.length >= 3 ? labelled : lines[index + 1] ?? null;
}

function analyseText(
  text: string,
  expectedCredentialId: string,
  confidenceValues: number[],
  pagesReviewed: number,
  totalPages: number,
): Review {
  const lines = cleanLines(text);
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const credentialId = expectedCredentialId.trim();
  const findings: Finding[] = [];

  const institution = firstMatchingLine(
    lines,
    /\b(university|polytechnic|college|academy|school|institute|institution)\b/i,
  );
  const qualification = firstMatchingLine(
    lines,
    /\b(bachelor|master|doctor|degree|diploma|certificate|qualification|b\.?sc|m\.?sc|ph\.?d|hnd|nd)\b/i,
  );
  const issueDate = firstMatchingLine(
    lines,
    /\b(?:0?[1-9]|[12]\d|3[01])[\s/.-](?:0?[1-9]|1[0-2]|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s/.,-](?:19|20)\d{2}\b|\b(?:19|20)\d{2}\b/i,
  );
  const recipient = afterLabel(
    lines,
    /^(?:this is to certify that|awarded to|presented to|recipient|student name|name)\b/i,
  );

  if (text.replace(/\s/g, "").length < 80) {
    findings.push({
      severity: "warning",
      title: "Limited readable text",
      detail: "The local OCR engine found very little text. Inspect the document manually or upload a clearer scan.",
    });
  } else {
    findings.push({
      severity: "info",
      title: "Document text extracted",
      detail: `${text.length.toLocaleString()} characters were read locally from ${pagesReviewed} page${pagesReviewed === 1 ? "" : "s"}.`,
    });
  }

  if (credentialId) {
    const idMatch = normalized.includes(credentialId.toLowerCase().replace(/\s+/g, " "));
    findings.push(idMatch
      ? {
          severity: "info",
          title: "Credential ID located",
          detail: "The entered credential ID appears in the document.",
        }
      : {
          severity: "warning",
          title: "Credential ID not located",
          detail: "The entered credential ID was not found in the extracted text. Confirm the identifier before issuing.",
        });
  }

  if (!institution) {
    findings.push({
      severity: "warning",
      title: "Institution name not confidently identified",
      detail: "Confirm that the issuing institution is clearly shown on the credential.",
    });
  }
  if (!issueDate) {
    findings.push({
      severity: "warning",
      title: "Issue date not identified",
      detail: "Confirm the award or issue date before issuance.",
    });
  }
  if (!qualification) {
    findings.push({
      severity: "warning",
      title: "Qualification not identified",
      detail: "Confirm that the qualification or award title is clearly stated.",
    });
  }

  const suspiciousTerms = ["lorem ipsum", "sample certificate", "specimen", "template only", "photoshop"];
  const matchedTerms = suspiciousTerms.filter((term) => normalized.includes(term));
  if (matchedTerms.length > 0) {
    findings.push({
      severity: "critical",
      title: "Placeholder or editing language detected",
      detail: `Review the document carefully. Detected: ${matchedTerms.join(", ")}.`,
    });
  }

  if (totalPages > pagesReviewed) {
    findings.push({
      severity: "warning",
      title: "Page review limit reached",
      detail: `For performance, the private review checked the first ${pagesReviewed} of ${totalPages} pages. Review the remaining pages manually.`,
    });
  }

  const critical = findings.some((finding) => finding.severity === "critical");
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const averageConfidence = confidenceValues.length
    ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
    : 85;
  const confidence = Math.round(Math.max(0, Math.min(100, averageConfidence - warnings * 4)));

  return {
    verdict: critical ? "high-risk" : warnings > 0 ? "review" : "ready",
    confidence,
    summary: critical
      ? "The private review found language that requires careful human inspection."
      : warnings > 0
        ? "Some expected details could not be confirmed automatically. Complete the highlighted checks manually."
        : "Expected document elements were located. An authorised person must still make the final issuance decision.",
    extractedFields: {
      institution,
      recipient,
      qualification,
      issueDate,
      credentialId: credentialId || null,
    },
    findings,
    pagesReviewed,
    textLength: text.length,
  };
}

async function createOcrWorker(
  setProgress: (progress: number, status: string) => void,
) {
  const tesseract = await loadTesseract();
  return tesseract.createWorker("eng", 1, {
    workerPath: TESSERACT_WORKER,
    corePath: TESSERACT_CORE,
    langPath: TESSERACT_LANGUAGE,
    logger: (message) => {
      if (typeof message.progress === "number") {
        setProgress(Math.round(message.progress * 100), message.status ?? "Reading document");
      }
    },
  });
}

async function readImage(
  file: File,
  setProgress: (progress: number, status: string) => void,
) {
  const worker = await createOcrWorker(setProgress);
  try {
    const result = await worker.recognize(file);
    return {
      text: result.data.text,
      confidenceValues: [result.data.confidence],
      pagesReviewed: 1,
      totalPages: 1,
    };
  } finally {
    try {
      await worker.terminate();
    } catch (error) {
      console.warn("Local OCR worker cleanup was skipped.", error);
    }
  }
}

async function readPdf(
  file: File,
  setProgress: (progress: number, status: string) => void,
) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const totalPages = pdf.numPages;
  const pagesToReview = Math.min(totalPages, MAX_PDF_PAGES);
  const text: string[] = [];
  const confidenceValues: number[] = [];
  let worker: OcrWorker | null = null;

  try {
    for (let pageNumber = 1; pageNumber <= pagesToReview; pageNumber += 1) {
      setProgress(Math.round(((pageNumber - 1) / pagesToReview) * 100), `Reading page ${pageNumber} of ${pagesToReview}`);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str ?? "").join(" ").trim();

      if (pageText.length >= 80) {
        text.push(pageText);
        confidenceValues.push(95);
        continue;
      }

      worker ??= await createOcrWorker(setProgress);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("The document canvas could not be prepared.");
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      const result = await worker.recognize(canvas);
      text.push(result.data.text);
      confidenceValues.push(result.data.confidence);
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    try {
      await worker?.terminate();
    } catch (error) {
      console.warn("Local OCR worker cleanup was skipped.", error);
    }
    try {
      if (typeof pdf.destroy === "function") await pdf.destroy();
    } catch (error) {
      console.warn("Local PDF reader cleanup was skipped.", error);
    }
  }

  return {
    text: text.join("\n"),
    confidenceValues,
    pagesReviewed: pagesToReview,
    totalPages,
  };
}

export function LocalDocumentReview({
  document: sourceDocument,
  credentialId,
}: {
  document: File | null;
  credentialId: string;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");

  useEffect(() => {
    setReview(null);
    setMessage("");
    setProgress(0);
    setProgressStatus("");
  }, [sourceDocument]);

  async function runReview() {
    if (!sourceDocument) return;
    setReviewing(true);
    setReview(null);
    setMessage("");
    setProgress(0);
    setProgressStatus("Preparing private document reader");

    try {
      const supported = sourceDocument.type === "application/pdf" || sourceDocument.type.startsWith("image/");
      if (!supported) throw new Error("Private review supports PDF and image files.");
      if (sourceDocument.size > 12 * 1024 * 1024) {
        throw new Error("Choose a document smaller than 12 MB for browser-based review.");
      }

      const extracted = sourceDocument.type === "application/pdf"
        ? await readPdf(sourceDocument, (value, status) => {
            setProgress(value);
            setProgressStatus(status);
          })
        : await readImage(sourceDocument, (value, status) => {
            setProgress(value);
            setProgressStatus(status);
          });

      setReview(analyseText(
        extracted.text,
        credentialId,
        extracted.confidenceValues,
        extracted.pagesReviewed,
        extracted.totalPages,
      ));
      setProgress(100);
      setProgressStatus("Private review complete");
    } catch (error) {
      console.error("Private document review failed", error);
      setMessage(error instanceof Error
        ? error.message
        : "The private document review could not be completed.");
    } finally {
      setReviewing(false);
    }
  }

  const tone = review?.verdict === "ready"
    ? "border-emerald-200 bg-emerald-50/60"
    : review?.verdict === "high-risk"
      ? "border-red-200 bg-red-50/60"
      : "border-amber-200 bg-amber-50/60";

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
          <ShieldCheckIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Private AI-assisted review</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            OCR and document checks run inside this browser. The source file is never uploaded to EduTrust or an AI provider.
          </p>
          <button
            type="button"
            disabled={!sourceDocument || reviewing}
            onClick={runReview}
            className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {reviewing ? "Reviewing locally…" : "Run private document review"}
          </button>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            The OCR engine is downloaded when needed. Results are advisory and cannot prove authenticity; an authorised registrar makes the final decision.
          </p>
        </div>
      </div>

      {reviewing && (
        <div className="mt-4" role="status">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{progressStatus}</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {message && (
        <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-white p-3 text-xs leading-5 text-amber-900" role="alert">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{message} You can still complete the document checks manually.</span>
        </div>
      )}

      {review && (
        <div className={`mt-4 rounded-lg border p-4 ${tone}`}>
          <div className="flex items-start gap-3">
            {review.verdict === "ready"
              ? <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              : <AlertCircleIcon className={`mt-0.5 size-5 shrink-0 ${review.verdict === "high-risk" ? "text-red-700" : "text-amber-700"}`} />}
            <div>
              <strong className="text-sm font-semibold text-slate-900">
                {review.verdict === "ready"
                  ? "Ready for human confirmation"
                  : review.verdict === "high-risk"
                    ? "High-risk findings"
                    : "Human review recommended"}
              </strong>
              <p className="mt-1 text-xs leading-5 text-slate-700">{review.summary}</p>
              <span className="mt-2 inline-block text-[11px] font-semibold text-slate-500">
                OCR confidence {review.confidence}% · {review.pagesReviewed} page{review.pagesReviewed === 1 ? "" : "s"} checked
              </span>
            </div>
          </div>

          {Object.values(review.extractedFields).some(Boolean) && (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {Object.entries(review.extractedFields).filter(([, value]) => value).map(([key, value]) => (
                <div className="rounded-md border border-white/80 bg-white/80 px-3 py-2" key={key}>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="mt-1 text-xs font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <ul className="mt-3 space-y-2">
            {review.findings.map((finding, index) => (
              <li className="rounded-md border border-white/80 bg-white/80 px-3 py-2" key={`${finding.title}-${index}`}>
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-xs font-semibold text-slate-800">{finding.title}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${finding.severity === "critical" ? "bg-red-100 text-red-700" : finding.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{finding.severity}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{finding.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
