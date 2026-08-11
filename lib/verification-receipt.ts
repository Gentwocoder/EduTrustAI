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

function chunks(value: string, width = 76) {
  const result: string[] = [];
  for (let index = 0; index < value.length; index += width) {
    result.push(value.slice(index, index + width));
  }
  return result.length ? result : [""];
}

function buildPdf(data: VerificationReceiptData) {
  const issued = data.issuedAt > 0
    ? new Date(data.issuedAt * 1000).toISOString()
    : "Not available";
  const expires = data.expiresAt && data.expiresAt > 0
    ? new Date(data.expiresAt * 1000).toISOString()
    : "No expiry registered";

  const rows = [
    { label: "Verification result", value: data.status.toUpperCase() },
    { label: "Institution", value: data.institution },
    { label: "Issuer wallet", value: data.issuer },
    { label: "Credential ID hash", value: data.credentialIdHash },
    { label: "Document check", value: data.documentCheck },
    { label: "Issued", value: issued },
    { label: "Expires", value: expires },
    { label: "Network", value: `${data.network} (chain ID ${data.chainId})` },
    { label: "Registry contract", value: data.registryAddress },
    { label: "Issuance transaction", value: data.transactionHash ?? "Not available from registry event history" },
    { label: "Replacement credential", value: data.replacement || "None" },
    { label: "Verified at", value: data.verifiedAt.toISOString() },
  ];

  const commands = [
    "0.11 0.18 0.32 rg",
    "0 724 612 68 re f",
    "1 1 1 rg",
    "BT /F2 20 Tf 0 Tc 42 758 Td (EduTrust Verification Receipt) Tj ET",
    "BT /F1 9 Tf 0 Tc 42 739 Td (Independent BOT Chain registry result) Tj ET",
    "0.12 0.16 0.23 rg",
    "BT /F2 11 Tf 0 Tc 42 694 Td (Verification details) Tj ET",
  ];

  let y = 666;
  for (const row of rows) {
    commands.push(`BT /F2 9 Tf 0 Tc 42 ${y} Td (${pdfText(row.label)}) Tj ET`);
    if (row.value.length <= 54) {
      commands.push(`BT /F1 9 Tf 0 Tc 188 ${y} Td (${pdfText(row.value)}) Tj ET`);
      y -= 25;
    } else {
      y -= 15;
      for (const line of chunks(row.value)) {
        commands.push(`BT /F1 8.5 Tf 0 Tc 42 ${y} Td (${pdfText(line)}) Tj ET`);
        y -= 13;
      }
      y -= 12;
    }
    commands.push("0.91 0.93 0.95 RG", `42 ${y + 10} m 570 ${y + 10} l S`);
  }

  const footerLine = Math.max(68, y - 2);
  commands.push(
    "0.82 0.86 0.91 RG",
    `42 ${footerLine} m 570 ${footerLine} l S`,
    "0.35 0.4 0.5 rg",
    `BT /F1 8 Tf 0 Tc 42 ${footerLine - 20} Td (Point-in-time report. Re-check the live registry before relying on this receipt.) Tj ET`,
    `BT /F1 8 Tf 0 Tc 42 ${footerLine - 35} Td (Credential hashes are integrity evidence. No private student data is included.) Tj ET`,
  );

  const stream = commands.join("\n");
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
