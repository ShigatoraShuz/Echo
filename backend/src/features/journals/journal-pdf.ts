import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FacialExpressionResult, JournalSignalComparison } from '@echo/contracts';
import type { AnalysisResponse } from './journals.service.js';

type Entry = { title: string; body: string; created_at?: string; mood?: string | null; perspective?: string | null };
type ExportResults = {
  analysis?: AnalysisResponse | null;
  face?: { status: string; result: FacialExpressionResult | null; comparison?: JournalSignalComparison } | null;
  analysisNotice?: string;
  gentleWording?: boolean;
};
const green = rgb(.12, .32, .25), ink = rgb(.13, .20, .17), muted = rgb(.39, .45, .40);
const labels: Record<string, string> = {
  anhedonia: 'Interest', depressed_mood: 'Feeling down', sleep: 'Sleep', fatigue: 'Energy',
  appetite: 'Appetite', worthlessness_guilt: 'Self-worth', concentration: 'Concentration', psychomotor: 'Movement',
};
const pretty = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

/** Exports saved results only. This renderer never starts inference or reads camera frames. */
export async function journalPdf(entry: Entry, saved: ExportResults = {}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(entry.title || 'Untitled reflection');
  pdf.setAuthor('ECHO');
  pdf.setCreator('ECHO Journal');
  const font = await pdf.embedFont(await readFile(resolve(__dirname, '../../../assets/fonts/NotoSans-Regular.ttf')), { subset: true });
  const logo = await pdf.embedPng(await readFile(resolve(__dirname, '../../../assets/echo-logo.png')));
  const supported = new Set(font.getCharacterSet());
  const width = 595.28, height = 841.89, margin = 48, contentWidth = width - margin * 2;
  let page: PDFPage, y = 0, sectionNumber = 0;
  function newPage() {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(.987, .981, .961) });
    page.drawImage(logo, { x: margin, y: height - 93, width: 54, height: 54, opacity: .18 });
    page.drawText('ECHO', { x: 116, y: height - 58, size: 20, font, color: green });
    page.drawText('YOUR PRIVATE REFLECTIONS', { x: 116, y: height - 75, size: 8, font, color: muted });
    page.drawLine({ start: { x: margin, y: height - 108 }, end: { x: width - margin, y: height - 108 }, color: rgb(.81, .85, .80), thickness: .7 });
    y = height - 137;
  }
  function room(points: number) { if (y - points < 66) newPage(); }
  function wrap(value: string, size: number): string[] {
    const normalized = value.replace(/\t/g, '    ');
    for (const c of normalized) if (!/[\r\n]/.test(c) && !supported.has(c.codePointAt(0)!))
      throw Error('The PDF font cannot preserve one or more characters in this reflection.');
    const lines: string[] = [];
    for (const paragraph of normalized.split(/\r?\n/)) {
      let current = '';
      for (const c of paragraph) {
        if (font.widthOfTextAtSize(current + c, size) > contentWidth) {
          const space = current.lastIndexOf(' ');
          if (space > 0) { lines.push(current.slice(0, space)); current = current.slice(space + 1); }
          else { lines.push(current); current = ''; }
        }
        current += c;
      }
      lines.push(current);
    }
    return lines;
  }
  function text(value: string, size = 10.5, color = ink, lineHeight = 17) {
    for (const line of wrap(value, size)) {
      room(lineHeight);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= lineHeight;
    }
    y -= 7;
  }
  function section(title: string) {
    room(72); y -= 9;
    text(`${String(++sectionNumber).padStart(2, '0')}  ${title.toUpperCase()}`, 10, green, 15);
  }
  function scores(values: Array<[string, number]>) {
    room(values.length * 23 + 7);
    for (const [name, value] of values.sort((a, b) => b[1] - a[1])) {
      room(25);
      page.drawText(pretty(name), { x: margin, y, size: 10, font, color: ink });
      page.drawRectangle({ x: 194, y: y - 1, width: 260, height: 7, color: rgb(.88, .91, .86) });
      page.drawRectangle({ x: 194, y: y - 1, width: 260 * Math.min(1, Math.max(0, value)), height: 7, color: green });
      page.drawText(value > 0 && value < .001 ? '<0.1%' : `${(value * 100).toFixed(1)}%`, { x: 472, y, size: 9, font, color: muted });
      y -= 23;
    }
    y -= 7;
  }
  newPage();
  text(entry.title || 'Untitled reflection', 25, green, 34);
  text(`Saved ${entry.created_at ? new Date(entry.created_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Manila' }) + ' (UTC+08:00)' : 'date unavailable'}`, 9, muted);
  section('Your reflection');
  text(entry.body);
  if (entry.perspective) { section('ECHO perspective'); text(entry.perspective); }
  const wording = (value:string) => saved.gentleWording === false ? value : value.replace(/\bdepressive[- ]symptom/gi,"Cloudy days").replace(/\b(?:depression|depressed|depressive)\b/gi,"Cloudy days");
  const analysis = saved.analysis;
  const result = analysis?.result;
  if (saved.analysis?.result && saved.analysis.result.schemaVersion !== 'echo-model-pipeline-v2') room(365);
  section('Reflection insights');
  if (!analysis || analysis.is_demo_data || result?.isSimulated) {
    text(saved.analysisNotice || 'No saved analysis is available for this reflection. Pending, failed, or unavailable results are not scored as zero.');
  } else {
    if (analysis.summary) text(wording(analysis.summary));
    if (result && result.schemaVersion !== 'echo-model-pipeline-v2') {
      text(`Emotion noticed: ${pretty(result.dominantEmotion)}`, 15, green, 23);
      text('Relative model scores support reflection; they do not measure how strongly you feel.', 9, muted);
      scores(result.emotionDistribution.map(item => [item.emotion, item.value]));
      if (result.schemaVersion === 'echo-journal-analysis-v3') {
        section('PHQ-8 journal estimate');
        const screening = result.journalScreening;
        if (screening.status === 'available' && screening.items) {
          text(screening.coverage === 8 && screening.total !== null
            ? `Complete journal estimate: ${screening.total} / 24`
            : `${screening.coverage} / 8 criteria evidenced. A complete total is unavailable.`);
          const frequencies = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'];
          for (const [name, value] of Object.entries(screening.items))
            text(`${labels[name] || pretty(name)}: ${value === null ? 'Not evidenced in this reflection' : `${value} - ${frequencies[value]}`}`, 10, ink, 15);
          text('Missing evidence is not zero. These experimental estimates come from journal text and are separate from a completed PHQ-8 questionnaire.', 9, muted);
        } else text(`Saved estimate ${screening.status}. No complete score is available.`);
        const suggestion = result.cbtRecommendation;
        if (suggestion?.status === 'available') room(Math.min(580, wrap(suggestion.text, 10.5).length * 17 + 145));
        section('Suggested next steps');
        if (result.supportReviewRequired || suggestion?.status === 'support_required')
          text('Personal recommendations are paused for this reflection. Explore support options in ECHO or talk to a qualified professional.');
        else if (suggestion?.status === 'available') {
          text(wording(suggestion.text).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1'));
          text(`Saved suggestion by ${suggestion.model.providerName} / ${suggestion.model.modelVersion}. Choose what feels useful; these steps are optional.`, 8.5, muted);
        } else text('No saved recommendation is available for this reflection.');
      }
      text(`Saved model: ${result.providerName} / ${result.modelVersion}`, 8.5, muted);
    } else if (result) {
      // Preserve historical pipeline results in readable, indented paragraphs.
      const append = (value: unknown, prefix = '') => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) { value.forEach(item => append(item, prefix)); return; }
        if (typeof value === 'object') { for (const [key, item] of Object.entries(value)) append(item, `${prefix}${pretty(key)}: `); return; }
        text(wording(prefix + String(value)), 9, ink, 15);
      };
      append(result.stages);
    } else if (analysis.perspective) text(analysis.perspective);
    text(`Analysis saved: ${analysis.created_at}`, 8.5, muted);
  }
  const face = saved.face;
  if (face?.result?.status === 'available') room(345);
  section('Facial expression results');
  if (face?.result?.status === 'available') {
    text(`Expression signal: ${pretty(face.result.prediction)}`, 14, green, 22);
    text('Uncalibrated model scores describe a visible expression, not how you feel or a diagnosis.', 9, muted);
    scores(Object.entries(face.result.classProbabilities));
    const comparison = face.comparison;
    if (comparison && comparison.status !== 'unavailable')
      text(`${comparison.status === 'same' ? 'Same leading label' : 'Different leading labels'} - writing: ${comparison.textEmotion}; face: ${comparison.faceEmotion}.`, 10);
    text(`Captured estimate: ${face.result.generatedAt}`, 8.5, muted);
  } else text(`No available facial result is included. Saved status: ${face?.status || 'not available'}.`);
  section('About this export');
  text('This PDF contains your saved reflection and the results available at export time. No analysis was generated for this download. Attached photos and camera images are not included.', 9, muted);
  text('ECHO supports reflection and does not provide a diagnosis or replace a qualified mental health professional.', 9, muted);
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawLine({ start: { x: margin, y: 49 }, end: { x: width - margin, y: 49 }, thickness: .6, color: rgb(.81, .85, .80) });
    item.drawText('PRIVATE  /  ECHO JOURNAL', { x: margin, y: 32, size: 8, font, color: muted });
    item.drawText(`${index + 1} / ${pages.length}`, { x: width - 88, y: 32, size: 8, font, color: muted });
  });
  return Buffer.from(await pdf.save());
}
