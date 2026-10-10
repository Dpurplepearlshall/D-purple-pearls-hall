import { describe, expect, it } from 'vitest';
import { createTextPdf } from './pdf.js';

describe('PDF data exports', () => {
  it('creates a valid multi-page PDF and escapes text content', () => {
    const pdf = createTextPdf('Student (list)', [
      'Admission number: ST-001',
      'Student name: A (Pearl) \\ Student'
    ]);
    const text = pdf.toString('ascii');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 1');
    expect(text).toContain('Student \\(list\\)');
    expect(text).toContain('A \\(Pearl\\) \\\\ Student');
    expect(text.endsWith('%%EOF')).toBe(true);
  });

  it('splits long exports across PDF pages', () => {
    const pdf = createTextPdf('Data backup', Array.from({ length: 60 }, (_, index) => `Record ${index + 1}`));
    expect(pdf.toString('ascii')).toContain('/Count 2');
  });
});
