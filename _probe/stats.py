
import lxml.html as LH, sys, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
tot=0; funcs=0; evts=0; rows=[]
for f in sorted(Path("_probe/pages").glob("*.html")):
    doc = LH.fromstring(f.read_text(encoding="utf-8"))
    r = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')[0]
    txt = " ".join(r.text_content().replace("\u200b","").split())
    n_param = txt.count("参数及类型"); n_ev = txt.count("事件名：")
    funcs += n_param; evts += n_ev; tot += len(txt)
    rows.append((f.name, len(txt), n_param, n_ev))
print("TOTAL text chars:", tot, " ~tokens(zh 1ch≈1tok):", int(tot*0.9))
print("total 参数及类型 sections:", funcs, " total 事件名:", evts)
