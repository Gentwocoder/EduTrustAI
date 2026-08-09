"use client";

import { FormEvent, useState } from "react";

type ResultState = "idle" | "loading" | "verified" | "invalid" | "altered";

export function VerificationDemo() {
  const [credentialId, setCredentialId] = useState("EDU-2026-00128");
  const [state, setState] = useState<ResultState>("idle");

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    window.setTimeout(() => {
      setState(credentialId.trim().toUpperCase() === "EDU-2026-00128" ? "verified" : "invalid");
    }, 700);
  }

  return (
    <div className="verify-card">
      <div className="verify-card-head">
        <span className="scanner-icon">⌗</span>
        <div><strong>Credential verification</strong><small>Public portal · No sign-in required</small></div>
      </div>
      <form onSubmit={verify}>
        <label htmlFor="credential-id">Credential ID</label>
        <div className="input-row">
          <input id="credential-id" value={credentialId} onChange={(event) => { setCredentialId(event.target.value); setState("idle"); }} placeholder="e.g. EDU-2026-00128" />
          <button type="submit" disabled={state === "loading"}>{state === "loading" ? "Checking…" : "Verify"}</button>
        </div>
        <p className="field-hint">Try the sample ID: EDU-2026-00128</p>
      </form>

      <div className="sample-divider"><span>or test the AI integrity check</span></div>
      <button className="sample-scan" type="button" onClick={() => { setState("loading"); window.setTimeout(() => setState("altered"), 850); }} disabled={state === "loading"}>
        <span>✦</span><div><strong>Analyze altered sample</strong><small>Compare a modified certificate with its on-chain record</small></div><b>→</b>
      </button>

      {state === "verified" && (
        <div className="result result-valid" role="status">
          <div className="result-title"><span>✓</span><div><strong>Credential verified</strong><small>Record confirmed on BOT Chain</small></div></div>
          <dl>
            <div><dt>Graduate</dt><dd>Amara Okafor</dd></div>
            <div><dt>Qualification</dt><dd>B.Sc. Computer Science</dd></div>
            <div><dt>Institution</dt><dd>Atlas University</dd></div>
            <div><dt>Status</dt><dd className="status-valid">Valid</dd></div>
          </dl>
          <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">View blockchain record <span>↗</span></a>
        </div>
      )}

      {state === "invalid" && (
        <div className="result result-invalid" role="alert">
          <div className="result-title"><span>!</span><div><strong>Record not found</strong><small>Check the ID or contact the issuing institution.</small></div></div>
        </div>
      )}

      {state === "altered" && (
        <div className="result result-altered" role="alert">
          <div className="result-title"><span>!</span><div><strong>Alteration detected</strong><small>AI comparison completed against the issued record.</small></div></div>
          <dl>
            <div><dt>Field changed</dt><dd>Classification</dd></div>
            <div><dt>Issued record</dt><dd>Second Class Upper</dd></div>
            <div><dt>Uploaded document</dt><dd className="status-alert">First Class</dd></div>
            <div><dt>Confidence</dt><dd>98%</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
