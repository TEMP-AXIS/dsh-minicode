
import lxml.html as LH, sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
rows=[]
for f in sorted(Path("_probe/pages").glob("*.html")):
    doc = LH.fromstring(f.read_text(encoding="utf-8"))
    r = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')
    if not r: rows.append((f.name,"NO vp-doc",0,0,0,0,0)); continue
    root=r[0]
    h1 = " ".join(root.xpath('.//h1')[0].text_content().split()) if root.xpath('.//h1') else ""
    h2 = [ " ".join(x.text_content().replace("\u200b","").split()) for x in root.xpath('.//h2')]
    h3 = len(root.xpath('.//h3')); h4=len(root.xpath('.//h4'))
    txt = " ".join(root.text_content().replace("\u200b","").split())
    params = txt.count("参数及类型")
    rows.append((f.name,h1,len(h2),h3,h4,len(root.xpath('.//pre')),params,len(txt)))
for r_ in rows:
    print(" | ".join(str(x) for x in r_))
