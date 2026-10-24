import fs from 'node:fs';
const p = 'C:/Users/mi/AppData/Local/Programs/DeepSeek Harness/resources/app.asar';
const fd = fs.openSync(p,'r');
const b = Buffer.alloc(32); fs.readSync(fd,b,0,32,0);
const hsize = b.readUInt32LE(12);
const hb = Buffer.alloc(hsize); fs.readSync(fd,hb,0,hsize,16);
const hdr = JSON.parse(hb.toString('utf8').replace(/\0+$/,''));
const out = [];
(function walk(node, prefix){
  for (const [k,v] of Object.entries(node.files||{})) {
    const pp = prefix ? prefix + '/' + k : k;
    if (v.files) walk(v, pp); else out.push(pp);
  }
})(hdr, '');
const pat = process.argv[2] || '';
console.log(out.filter(x=>x.includes(pat)).slice(0, Number(process.argv[3]||80)).join('\n'));
console.log('total', out.length);
