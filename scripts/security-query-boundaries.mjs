import ts from "typescript";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
const root=process.cwd(); const findings=[]; let queries=0;
async function walk(dir) {
 for(const entry of await readdir(dir,{withFileTypes:true})) {
  const path=join(dir,entry.name);
  if(entry.isDirectory()) { if(entry.name!=="__tests__") await walk(path); continue; }
  if(!path.endsWith(".ts") || path.endsWith(".test.ts")) continue;
  const source=ts.createSourceFile(path,await readFile(path,"utf8"),ts.ScriptTarget.Latest,true);
  function visit(node) {
   if(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text==="from") {
    const receiver=node.expression.expression.getText(source);
    if(!["Buffer","Array","Uint8Array"].includes(receiver) && !/\.storage$/.test(receiver)) {
     queries++;
     const arg=node.arguments[0];
     const rule=arg && ts.isStringLiteral(arg) && arg.text.includes(".") ? "dotted table" : !/\.schema\(/.test(receiver) ? "missing explicit schema" : null;
     if(rule) findings.push({file:relative(root,path),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,rule});
    }
   }
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
}
await walk(join(root,"backend/src"));
for(const finding of findings) console.error(JSON.stringify(finding));
console.info(JSON.stringify({queries,findings:findings.length}));
if(findings.length) process.exitCode=1;
