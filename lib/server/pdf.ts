function escapeText(value: string): string {
  let text = String(value ?? "");
  text = text.replace(/[^\x20-\x7E]/g, ".");
  text = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  return text;
}

export function buildPdf(lines: string[]): Buffer {
  const pageWidth = 612;
  const pageHeight = 792;
  let top = pageHeight - 56;
  const step = 18;
  const fontName = "/F1";
  const fontSize = 11;

  const contentParts: string[] = [];
  for (const line of lines) {
    contentParts.push("BT");
    contentParts.push(`${fontName} ${fontSize} Tf`);
    contentParts.push(`56 ${top} Td`);
    contentParts.push(`(${escapeText(line)}) Tj`);
    contentParts.push("ET");
    top -= step;
  }
  const content = contentParts.join("\n");

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`
  );
  objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const header = "%PDF-1.4\n";
  let output = Buffer.from(header, "latin1");
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(output.length);
    const objHeader = Buffer.from(`${i + 1} 0 obj\n`, "latin1");
    const objBody = Buffer.from(objects[i] + "\n", "latin1");
    const objFooter = Buffer.from("endobj\n", "latin1");
    output = Buffer.concat([output, objHeader, objBody, objFooter]);
  }

  const xrefOffset = output.length;
  const xrefLines: string[] = [`xref`, `0 ${objects.length + 1}`];
  xrefLines.push("0000000000 65535 f ");
  for (let i = 0; i < offsets.length; i++) {
    xrefLines.push(`${String(offsets[i]).padStart(10, "0")} 00000 n `);
  }
  const xref = Buffer.from(xrefLines.join("\n") + "\n", "latin1");
  const trailer = Buffer.from(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    "latin1"
  );

  return Buffer.concat([output, xref, trailer]);
}
