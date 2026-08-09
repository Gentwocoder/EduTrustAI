import { VerificationDemo } from "@/components/verification-demo";

const networkItems = [
  { value: "BOT Chain", label: "Credential network" },
  { value: "AI-assisted", label: "Fraud screening" },
  { value: "Privacy-first", label: "No documents on-chain" },
];

export default function Home() {
  return (
    <main>
      <nav className="nav-shell" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="EduTrust AI home">
          <span className="brand-mark">E</span>
          <span>EduTrust <b>AI</b></span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#verification">Verify</a>
          <a href="#institutions">For institutions</a>
        </div>
        <a className="nav-cta" href="/dashboard">Institution portal</a>
      </nav>

      <section className="hero" id="top">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="hero-copy">
          <div className="eyebrow"><span /> Built for trusted African education</div>
          <h1>Academic credentials.<br /><em>Verified in seconds.</em></h1>
          <p className="hero-lead">
            EduTrust AI helps institutions issue tamper-evident credentials and
            gives employers instant, privacy-safe verification powered by AI and BOT Chain.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#verification">Verify a credential <span>→</span></a>
            <a className="button button-ghost" href="/dashboard">Issue credentials</a>
          </div>
          <div className="trust-note">
            <div className="avatar-stack" aria-hidden="true">
              <span>AO</span><span>KM</span><span>LN</span>
            </div>
            <p><strong>Designed for real institutions</strong><br />Secure, auditable and easy to adopt</p>
          </div>
        </div>

        <div className="hero-visual" aria-label="Example verified credential">
          <div className="chain-badge"><span className="pulse" /> BOT Chain Mainnet</div>
          <article className="credential-card">
            <div className="credential-top">
              <div className="school-seal">AU</div>
              <div><strong>Atlas University</strong><small>Digital Academic Credential</small></div>
              <span className="verified-pill">✓ Verified</span>
            </div>
            <div className="credential-body">
              <small>This certifies that</small>
              <h2>Amara Okafor</h2>
              <p>has successfully completed the requirements for</p>
              <h3>B.Sc. Computer Science</h3>
              <div className="credential-meta">
                <div><small>Classification</small><strong>Second Class Upper</strong></div>
                <div><small>Issued</small><strong>24 July 2026</strong></div>
              </div>
            </div>
            <div className="credential-footer">
              <div className="fake-qr" aria-label="QR verification code">
                {Array.from({ length: 49 }, (_, index) => <i key={index} className={(index * 7 + index % 5) % 3 === 0 ? "filled" : ""} />)}
              </div>
              <div><small>Credential ID</small><strong>EDU-2026-00128</strong><span>Anchored on BOT Chain</span></div>
              <div className="shield">✓</div>
            </div>
          </article>
          <div className="ai-card">
            <span className="ai-icon">✦</span>
            <div><small>AI integrity scan</small><strong>No alterations detected</strong></div>
            <span className="score">98%</span>
          </div>
        </div>
      </section>

      <section className="network-strip" aria-label="Platform highlights">
        {networkItems.map((item) => (
          <div key={item.value}><strong>{item.value}</strong><span>{item.label}</span></div>
        ))}
      </section>

      <section className="section-shell process" id="how-it-works">
        <div className="section-heading">
          <span className="kicker">One trusted record</span>
          <h2>From issuance to verification,<br />every step is accountable.</h2>
          <p>The original document stays private. Only its cryptographic fingerprint and status are recorded on-chain.</p>
        </div>
        <div className="process-grid">
          <article><span>01</span><div className="step-icon">⌁</div><h3>Institution issues</h3><p>An authorised school creates a signed digital credential from verified student records.</p></article>
          <article><span>02</span><div className="step-icon">◇</div><h3>BOT Chain anchors</h3><p>A tamper-evident fingerprint, issuer and status are recorded without exposing student data.</p></article>
          <article><span>03</span><div className="step-icon">✦</div><h3>AI verifies</h3><p>Upload or scan a credential. AI compares its contents and flags suspicious changes instantly.</p></article>
        </div>
      </section>

      <section className="verify-section" id="verification">
        <div className="section-shell verify-layout">
          <div className="verify-copy">
            <span className="kicker">Try the live flow</span>
            <h2>Trust the record,<br />not the paperwork.</h2>
            <p>Enter the demo credential ID to see the public verification experience an employer or institution receives.</p>
            <div className="privacy-callout"><span>⌾</span><div><strong>Privacy by design</strong><p>Student documents and personal records are never published to the blockchain.</p></div></div>
          </div>
          <VerificationDemo />
        </div>
      </section>

      <section className="section-shell institution" id="institutions">
        <div>
          <span className="kicker">For schools and universities</span>
          <h2>Issue once. Build trust everywhere.</h2>
          <p>Reduce manual verification requests, protect your institution’s reputation and give every graduate a credential they can confidently share.</p>
        </div>
        <a className="button button-dark" href="/dashboard">Open institution portal <span>→</span></a>
      </section>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark">E</span><span>EduTrust <b>AI</b></span></a>
        <p>A Lenage Technologies initiative · Built on BOT Chain</p>
        <span>© 2026 EduTrust AI</span>
      </footer>
    </main>
  );
}
