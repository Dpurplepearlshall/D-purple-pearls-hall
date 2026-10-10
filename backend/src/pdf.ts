function cleanText(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
}

function wrapLine(line: string, width: number) {
  const words = cleanText(line).split(/\s+/);
  const wrapped: string[] = [];
  let current = '';
  for (const word of words) {
    if (word.length > width) {
      if (current) wrapped.push(current);
      for (let offset = 0; offset < word.length; offset += width) {
        const segment = word.slice(offset, offset + width);
        if (segment.length === width) wrapped.push(segment);
        else current = segment;
      }
    } else if (!current) {
      current = word;
    } else if (current.length + word.length + 1 <= width) {
      current += ` ${word}`;
    } else {
      wrapped.push(current);
      current = word;
    }
  }
  if (current) wrapped.push(current);
  return wrapped.length ? wrapped : [''];
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function createTextPdf(title: string, contentLines: string[]) {
  const lines = [title, '='.repeat(Math.min(80, title.length)), ...contentLines]
    .flatMap((line) => wrapLine(line, 94));
  const pageLines = 52;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageLines) {
    pages.push(lines.slice(index, index + pageLines));
  }
  if (!pages.length) pages.push([]);

  const objects = new Map<number, Buffer>();
  const pageIds = pages.map((_, index) => 5 + index * 2);
  objects.set(1, Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'ascii'));
  objects.set(2, Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`, 'ascii'));
  objects.set(3, Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', 'ascii'));

  pages.forEach((pageLines, index) => {
    const contentId = 4 + index * 2;
    const pageId = pageIds[index];
    const text = [
      'BT',
      '/F1 9 Tf',
      '42 750 Td',
      '12 TL',
      ...pageLines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, 'T*']),
      'ET'
    ].join('\n');
    const content = Buffer.from(text, 'ascii');
    objects.set(contentId, Buffer.concat([
      Buffer.from(`<< /Length ${content.length} >>\nstream\n`, 'ascii'),
      content,
      Buffer.from('\nendstream', 'ascii')
    ]));
    objects.set(pageId, Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
      'ascii'
    ));
  });

  const objectCount = 3 + pages.length * 2;
  const header = Buffer.from('%PDF-1.4\n', 'ascii');
  const chunks: Buffer[] = [header];
  let byteOffset = header.length;
  const offsets = [0];
  for (let id = 1; id <= objectCount; id += 1) {
    const objectHeader = Buffer.from(`${id} 0 obj\n`, 'ascii');
    const object = objects.get(id);
    if (!object) throw new Error(`Missing PDF object ${id}.`);
    const objectFooter = Buffer.from('\nendobj\n', 'ascii');
    offsets[id] = byteOffset;
    chunks.push(objectHeader, object, objectFooter);
    byteOffset += objectHeader.length + object.length + objectFooter.length;
  }
  const xrefOffset = byteOffset;
  const xref = [
    `xref\n0 ${objectCount + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
  ].join('\n');
  chunks.push(Buffer.from(
    `${xref}\ntrailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    'ascii'
  ));
  return Buffer.concat(chunks);
}
