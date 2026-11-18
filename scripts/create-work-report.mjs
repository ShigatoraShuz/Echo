import { mkdirSync, writeFileSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const output = 'output/pdf/echo-work-report.pdf';
mkdirSync('output/pdf', { recursive: true });
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const width = 612, height = 792, margin = 54, bodySize = 10, lineHeight = 15;
const sections = [
  ['Echo implementation report', ['Completed work and verification record', 'Date: 18 November 2026']],
  ['Runtime and environments', [
    'Echo was rebuilt in Echo-latest-synthetic-only using the existing Thesis2_VENV Python 3.12.14 environment. No new Python runtime was downloaded.',
    'Separate local environments were prepared for speech, Nano, and expressive MOSS. The Thesis2 environment remains the shared read-only base.',
    'The Buddy runtime configuration and launcher paths use local Echo environments instead of environment junctions.'
  ]],
  ['SEA-LION, CBT, and PHQ8', [
    'The active SEA-LION path loads the shared base once, defaults to CBT, switches to the synthetic-only PHQ8 adapter for screening, and restores CBT afterward.',
    'Journal analysis reuses the existing safety classification instead of running the same distress classifier twice. PHQ8 agreement checks remain enabled.',
    'The journal PHQ8 meter shows complete classifications and bounded partial estimates. Deep analysis is an additive toggle that shows distress information without replacing the PHQ8 meter.',
    'CBT replies were updated around reviewer feedback: specific validation, actionable next steps, useful reflection, careful support for persistent low motivation, academic overload, family/future worries, exact list counts through ten, and complete endings.'
  ]],
  ['Speech recognition and read-aloud', [
    'Journal dictation and Buddy voice support Whisper by default and Browser speech as an explicit user choice. Browser speech uses SpeechRecognition or webkitSpeechRecognition and requires no Google Cloud API key.',
    'Browser recognition is English-only, bounded to 59 seconds and 4,000 characters, disclosed as potentially using the browser provider service, and never claimed to be universally offline or Google-powered.',
    'Journal dictation preserves typed text, appends finalized text, handles overflow, and cancels on navigation or entry changes. Buddy voice and live Talk reject stale or duplicate transcripts and pause recognition during generation and MOSS playback.',
    'The previous Google Cloud Speech-to-Text implementation and google-auth-library dependency were removed. MOSS remains the read-aloud provider with per-message speaker controls and ownership checks.'
  ]],
  ['Validation', [
    'Affected frontend voice and Buddy tests passed, including Browser speech lifecycle tests, journal dictation tests, live Talk tests, saved-message speech tests, duplicate transcript protection, stale-event rejection, cancellation, and playback exclusion.',
    'Affected backend tests passed, including journal dictation, local Buddy voice operations, live Talk provider checks, route authorization, and classification reuse.',
    'Frontend and backend type checks passed. Contracts built successfully. The production frontend build passed using the existing Supabase public configuration and Tailscale API URL.',
    'Manual validation remains appropriate for physical microphone permissions, browser vendor recognition quality, and subjective MOSS listening quality.'
  ]],
];
function wrap(text, max=92){const words=text.split(/\s+/);const lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>max){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;}
let page, y;
function newPage(){page=pdf.addPage([width,height]);y=height-margin;page.drawText('Echo work report',{x:margin,y:height-30,size:8,font:bold,color:rgb(.35,.35,.35)});page.drawLine({start:{x:margin,y:height-38},end:{x:width-margin,y:height-38},thickness:.6,color:rgb(.8,.8,.8)});}
function ensure(lines=1){if(y-lines*lineHeight<margin+25)newPage();}
newPage();
for(const [heading,paragraphs] of sections){ensure(3);page.drawText(heading,{x:margin,y,size:heading==='Echo implementation report'?22:14,font:bold,color:rgb(.08,.22,.28)});y-=heading==='Echo implementation report'?28:23;for(const paragraph of paragraphs){const lines=wrap(paragraph);ensure(lines.length+1);for(const line of lines){page.drawText(line,{x:margin,y,size:bodySize,font,color:rgb(.16,.16,.16)});y-=lineHeight;}y-=6;}}
for(const p of pdf.getPages()){p.drawText(`Page ${pdf.getPages().indexOf(p)+1}`,{x:width-margin-45,y:22,size:8,font,color:rgb(.4,.4,.4)});}
writeFileSync(output, await pdf.save());
console.log(output);
