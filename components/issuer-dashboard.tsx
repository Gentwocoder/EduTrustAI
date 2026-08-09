"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

type Credential = {
  id: string;
  student: string;
  qualification: string;
  issued: string;
  status: "Valid" | "Revoked";
};

const seedCredentials: Credential[] = [
  { id: "EDU-2026-00128", student: "Amara Okafor", qualification: "B.Sc. Computer Science", issued: "24 Jul 2026", status: "Valid" },
  { id: "EDU-2026-00127", student: "David Mensah", qualification: "B.Sc. Economics", issued: "23 Jul 2026", status: "Valid" },
  { id: "EDU-2026-00126", student: "Zainab Bello", qualification: "B.Eng. Civil Engineering", issued: "22 Jul 2026", status: "Revoked" },
];

export function IssuerDashboard() {
  const [view, setView] = useState<"overview" | "issue">("overview");
  const [credentials, setCredentials] = useState(seedCredentials);
  const [toast, setToast] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function issueCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setSubmitting(true);
    window.setTimeout(() => {
      const id = `EDU-2026-${String(credentials.length + 129).padStart(5, "0")}`;
      setCredentials((current) => [{
        id,
        student: String(data.get("student")),
        qualification: String(data.get("qualification")),
        issued: "9 Aug 2026",
        status: "Valid",
      }, ...current]);
      setSubmitting(false);
      setView("overview");
      setToast(`${id} issued and queued for BOT Chain confirmation.`);
    }, 900);
  }

  function revoke(id: string) {
    setCredentials((current) => current.map((credential) => credential.id === id ? { ...credential, status: "Revoked" } : credential));
    setToast(`${id} has been marked as revoked.`);
  }

  return (
    <main className="portal-shell">
      <aside className="portal-sidebar">
        <Link className="brand portal-brand" href="/"><span className="brand-mark">E</span><span>EduTrust <b>AI</b></span></Link>
        <div className="institution-profile"><span>AU</span><div><strong>Atlas University</strong><small>Verified institution</small></div></div>
        <nav aria-label="Institution portal">
          <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}><span>⌂</span> Overview</button>
          <button className={view === "issue" ? "active" : ""} onClick={() => setView("issue")}><span>＋</span> Issue credential</button>
          <Link href="/#verification"><span>⌗</span> Public verifier</Link>
          <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer"><span>◇</span> BOT Chain explorer</a>
        </nav>
        <div className="wallet-card"><small>Connected issuer wallet</small><strong>0xAc70…5567</strong><span><i /> BOT Mainnet · 677</span></div>
        <Link className="back-site" href="/">← Back to public site</Link>
      </aside>

      <section className="portal-main">
        <header className="portal-header">
          <div><small>Institution portal</small><strong>{view === "overview" ? "Credential overview" : "Issue a new credential"}</strong></div>
          <div className="admin-chip"><span>AO</span><div><strong>Admin Officer</strong><small>Authorised issuer</small></div></div>
        </header>

        {toast && <div className="toast" role="status"><span>✓</span>{toast}<button onClick={() => setToast("")} aria-label="Dismiss notification">×</button></div>}

        {view === "overview" ? (
          <div className="portal-content">
            <div className="portal-title"><div><span className="kicker">Atlas University</span><h1>Credential registry</h1><p>Issue, monitor and revoke credentials anchored to BOT Chain.</p></div><button className="issue-button" onClick={() => setView("issue")}>＋ Issue credential</button></div>
            <div className="stat-grid">
              <article><span className="stat-icon green">✓</span><div><small>Total issued</small><strong>{credentials.length + 124}</strong><em>+12 this month</em></div></article>
              <article><span className="stat-icon blue">◇</span><div><small>On-chain</small><strong>{credentials.filter((item) => item.status === "Valid").length + 123}</strong><em>BOT Chain confirmed</em></div></article>
              <article><span className="stat-icon amber">!</span><div><small>Revoked</small><strong>{credentials.filter((item) => item.status === "Revoked").length}</strong><em>Full audit history</em></div></article>
            </div>
            <section className="registry-table">
              <div className="table-heading"><div><h2>Recent credentials</h2><p>Latest records issued by your institution</p></div><label><span>⌕</span><input aria-label="Search credentials" placeholder="Search credentials" /></label></div>
              <div className="table-scroll"><table><thead><tr><th>Credential ID</th><th>Graduate</th><th>Qualification</th><th>Issued</th><th>Status</th><th /></tr></thead><tbody>
                {credentials.map((credential) => <tr key={credential.id}><td><strong className="mono">{credential.id}</strong></td><td>{credential.student}</td><td>{credential.qualification}</td><td>{credential.issued}</td><td><span className={`table-status ${credential.status.toLowerCase()}`}>{credential.status}</span></td><td>{credential.status === "Valid" ? <button className="revoke-button" onClick={() => revoke(credential.id)}>Revoke</button> : <span className="muted-action">—</span>}</td></tr>)}
              </tbody></table></div>
            </section>
          </div>
        ) : (
          <div className="portal-content issue-view">
            <button className="text-back" onClick={() => setView("overview")}>← Back to registry</button>
            <div className="issue-layout">
              <form className="issue-form" onSubmit={issueCredential}>
                <div><span className="kicker">New academic record</span><h1>Issue credential</h1><p>Only the credential fingerprint will be written to BOT Chain.</p></div>
                <div className="form-grid">
                  <label className="full">Student full name<input name="student" required defaultValue="Chinedu Eze" /></label>
                  <label>Student ID<input name="studentId" required defaultValue="ATL/2022/0941" /></label>
                  <label>Graduation date<input name="date" type="date" required defaultValue="2026-07-24" /></label>
                  <label className="full">Qualification<input name="qualification" required defaultValue="B.Sc. Information Technology" /></label>
                  <label>Classification<select name="classification" defaultValue="Second Class Upper"><option>First Class</option><option>Second Class Upper</option><option>Second Class Lower</option><option>Pass</option></select></label>
                  <label>Document fingerprint<input name="fingerprint" readOnly value="0x82f1…c94e" /></label>
                </div>
                <div className="privacy-banner"><span>⌾</span><p><strong>Privacy check passed</strong> No student name, grade or document will be published on-chain.</p></div>
                <button className="submit-credential" disabled={submitting}>{submitting ? "Submitting to BOT Chain…" : "Issue and anchor credential"}<span>→</span></button>
              </form>
              <aside className="chain-preview"><span className="chain-preview-icon">◇</span><h3>On-chain transaction</h3><p>This is the exact public payload that will be recorded.</p><dl><div><dt>Network</dt><dd>BOT Chain Mainnet</dd></div><div><dt>Chain ID</dt><dd>677</dd></div><div><dt>Issuer</dt><dd className="mono">0xAc70…5567</dd></div><div><dt>Credential ID hash</dt><dd className="mono">0x91d3…a201</dd></div><div><dt>Document hash</dt><dd className="mono">0x82f1…c94e</dd></div></dl><div className="not-stored"><strong>Never stored on-chain</strong><span>Student name · Grade · PDF · Email</span></div></aside>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
