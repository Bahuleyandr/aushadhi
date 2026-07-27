import fs from 'node:fs';
import readline from 'node:readline';
import { compileCombinationIdentityManifest, resolveCombinationIdentity }
  from 'file:///D:/Dev/Projects/aushadhi/src/lib/interaction-combination-identity.mjs';
const manifest=compileCombinationIdentityManifest(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));
const ART='D:/Dev/Projects/aushadhi/dist/latest/drugs.jsonl';
const out={total:0,by_status:{},reasons:{},resolved:[]};
for (const profile of ['internal-evaluation','production-open']) {
  const rl=readline.createInterface({input:fs.createReadStream(ART,'utf8'),crlfDelay:Infinity});
  let n=0;
  for await (const line of rl){ if(!line.trim())continue; n++;
    const r=resolveCombinationIdentity({product:JSON.parse(line),manifest,profile});
    const k=`${profile}:${r.status}`;
    out.by_status[k]=(out.by_status[k]??0)+1;
    if(r.reason) out.reasons[`${profile}:${r.reason}`]=(out.reasons[`${profile}:${r.reason}`]??0)+1;
    if(r.status==='reviewed_override') out.resolved.push({profile,code:r.source_identity.code,scd:r.rxnorm_scd.rxcui});
  }
  out.total=n;
}
console.log(JSON.stringify(out,null,2));
