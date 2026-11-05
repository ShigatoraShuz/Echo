import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function journalPdf(entry:{title:string;body:string;created_at?:string;mood?:string|null;perspective?:string|null}){
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(await readFile(resolve(__dirname,'../../../assets/fonts/NotoSans-Regular.ttf')),{subset:true});
 const blocks=[entry.title||'Untitled reflection',`Date: ${entry.created_at??''}`,entry.mood?`Mood: ${entry.mood}`:'',entry.body,entry.perspective??'','Attached photos are not included in this text PDF.'];
 const supported=new Set(font.getCharacterSet());
 for(const c of blocks.join(''))if(!/[\r\n\t]/.test(c)&&!supported.has(c.codePointAt(0)!))throw Error('The PDF font cannot preserve one or more characters in this reflection.');
 let page=pdf.addPage([595.28,841.89]),y=789;
 function line(text:string){if(y<55){page=pdf.addPage([595.28,841.89]);y=789;}page.drawText(text,{x:48,y,size:11,font,color:rgb(.08,.13,.12)});y-=17;}
 for(const block of blocks){
  for(const paragraph of block.replace(/\t/g,'    ').split(/\r?\n/)){
   let current='';for(const character of paragraph){if(font.widthOfTextAtSize(current+character,11)>495){line(current);current='';}current+=character;}line(current);
  }y-=10;
 }
 return Buffer.from(await pdf.save());
}
