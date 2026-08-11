export type VerificationReceiptData = {
  credentialIdHash: string;
  status: string;
  issuer: string;
  institution: string;
  documentCheck: string;
  network: string;
  chainId: number;
  registryAddress: string;
  transactionHash?: string | null;
  issuedAt: number;
  expiresAt?: number;
  replacement?: string | null;
  verifiedAt: Date;
};

function ascii(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function splitValue(label: string, value: string, width = 72) {
  const prefix = `${label}: `;
  if (prefix.length + value.length <= width) return [`${prefix}${value}`];
  const lines = [prefix.trimEnd()];
  for (let index = 0; index < value.length; index += width) {
    lines.push(`  ${value.slice(index, index + width)}`);
  }
  return lines;
}

function buildPdf(data: VerificationReceiptData) {
  const issued = data.issuedAt > 0
    ? new Date(data.issuedAt * 1000).toISOString()
    : "Not available";
  const expires = data.expiresAt && data.expiresAt > 0
    ? new Date(data.expiresAt * 1000).toISOString()
    : "No expiry registered";

  const lines = [
    ["Verification result", data.status.toUpperCase()],
    ["Institution", data.institution],
    ["Issuer wallet", data.issuer],
    ["Credential ID hash", data.credentialIdHash],
    ["Document check", data.documentCheck],
    ["Issued", issued],
    ["Expires", expires],
    ["Network", `${data.network} (chain ID ${data.chainId})`],
    ["Registry contract", data.registryAddress],
    ["Issuance transaction", data.transactionHash ?? "Not available from registry event history"],
    ["Replacement credential", data.replacement || "None"],
    ["Verified at", data.verifiedAt.toISOString()],
  ].flatMap(([label, value]) => splitValue(label, value));

  const contentCommands = [
    "0.11 0.18 0.32 rg",
    "0 724 612 68 re f",
    "1 1 1 rg",
    "BT /F2 20 Tf 42 758 Td (EduTrust Verification Receipt) Tj ET",
    "BT /F1 9 Tf 42 739 Td (Independent BOT Chain registry result) Tj ET",
    "0.12 0.16 0.23 rg",
    "BT /F2 11 Tf 42 694 Td (Verification details) Tj ET",
  ];

  let y = 670;
  for (const line of lines) {
    const isContinuation = line.startsWith("  ");
    contentCommands.push(
      `BT /${isContinuation ? "F1" : "F1"} ${isContinuation ? 8.5 : 9.5} Tf 42 ${y} Td (${pdfText(line)}) Tj ET`,
    );
    y -= isContinuation ? 14 : 19;
  }

  contentCommands.push(
    "0.85 0.88 0.92 RG",
    `42 ${Math.max(82, y - 4)} m 570 ${Math.max(82, y - 4)} l S`,
    "0.35 0.4 0.5 rg",
    `BT /F1 8 Tf 42 ${Math.max(62, y - 24)} Td (This receipt records the result observed at verification time. Re-check the live registry before relying on it.) Tj ET`,
    `BT /F1 8 Tf 42 ${Math.max(48, y - 38)} Td (Credential hashes are integrity evidence; this receipt does not reveal or certify private student data.) Tj ET`,
  );

  const stream = contentCommands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Title (EduTrust Verification Receipt) /Producer (EduTrust AI) /CreationDate (D:${data.verifiedAt.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}Z) >>`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

export function downloadVerificationReceipt(data: VerificationReceiptData) {
  const pdf = buildPdf(data);
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const suffix = data.credentialIdHash.slice(2, 10);
  anchor.href = url;
  anchor.download = `edutrust-verification-${suffix}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
