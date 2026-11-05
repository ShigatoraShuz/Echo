import {it,expect} from 'vitest';
import {PDFDocument} from 'pdf-lib';
import {journalPdf} from '../../src/features/journals/journal-pdf.js';
it('creates a Unicode PDF and paginates long saved journal text',async()=>{
 const bytes=await journalPdf({title:'Pagninilay — araw',created_at:'2026-11-04',body:'Kumusta? Maligayang araw.\n'.repeat(200)});
 expect(bytes.subarray(0,5).toString()).toBe('%PDF-');const doc=await PDFDocument.load(bytes);expect(doc.getPageCount()).toBeGreaterThan(1);
});
it('rejects unsupported glyphs rather than silently losing content',async()=>{
 await expect(journalPdf({title:'Journal',body:'Unsupported: 😀'})).rejects.toThrow(/preserve/);
});
