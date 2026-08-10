"use client";

import { useEffect, useState } from "react";
import { AlertCircleIcon, CheckCircleIcon, ShieldCheckIcon } from "@/components/icons";

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
  findings: Array<{
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
  }>;
};

export function DocumentReview({
  document,
  credentialId,
}: {
  document: File | null;
  credentialId: string;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setReview(null);
    setMessage("");
  }, [document]);

  async function runReview() {
    if (!document) return;
    setReviewing(true);
    setMessage("");
    setReview(null);

    try {
      const form = new FormData();
      form.set("document", document);
      form.set("credentialId", credentialId);
      const response = await fetch("/api/document-review", {
        method: "POST",
        body: form,
      });
      const data = await response.json() as { message?: string; review?: Review };
      if (!response.ok || !data.review) {
        throw new Error(data.message ?? "The document could not be reviewed.");
      }
      setReview(data.review);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The document could not be reviewed.");
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
          <h3 className="text-sm font-semibold text-slate-900">AI-assisted document review</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Optional advisory review for visible fields, inconsistencies and items that need human attention.
          </p>
          <button
            type="button"
            disabled={!document || reviewing}
            onClick={runReview}
            className="mt-3 inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {reviewing ? "Reviewing document…" : "Run AI review"}
          </button>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            The document is sent to the configured AI provider only when you click this button. AI never issues the credential; an authorised person makes the final decision.
          </p>
        </div>
      </div>

      {message && (
        <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-white p-3 text-xs leading-5 text-amber-900" role="status">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {review && (
        <div className={`mt-4 rounded-lg border p-4 ${tone}`}>
          <div className="flex items-start gap-3">
            {review.verdict === "ready"
              ? <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              : <AlertCircleIcon className={`mt-0.5 size-5 shrink-0 ${review.verdict === "high-risk" ? "text-red-700" : "text-amber-700"}`} />}
            <div>
              <strong className="text-sm font-semibold capitalize text-slate-900">
                {review.verdict === "ready" ? "Ready for human confirmation" : review.verdict === "high-risk" ? "High-risk findings" : "Human review recommended"}
              </strong>
              <p className="mt-1 text-xs leading-5 text-slate-700">{review.summary}</p>
              <span className="mt-2 inline-block text-[11px] font-semibold text-slate-500">AI confidence {review.confidence}%</span>
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

          {review.findings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {review.findings.map((finding, index) => (
                <li className="rounded-md border border-white/80 bg-white/80 px-3 py-2" key={`${finding.title}-${index}`}>
                  <strong className="text-xs font-semibold text-slate-800">{finding.title}</strong>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600">{finding.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
