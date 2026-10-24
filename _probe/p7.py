
import lxml.html as LH, sys, re
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
def clean(s): return " ".join(s.replace("\u200b","").split())
def doc_root(p):
    doc = LH.fromstring(Path(p).read_text(encoding="utf-8"))
    r=doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')
    return r[0] if r else None
print("=== update log ===")
print(clean(doc_root("_probe/pages/apis__update.html").text_content())[:1200])
print()
print("=== componentapi h2 + first section ===")
r=doc_root("_probe/pages/introduction__componentapi.html")
hs=[clean(x.text_content()) for x in r.xpath('.//h2')]
print(hs[:10])
h=[x for x in r.xpath('.//h2')][0]
ul=h.getnext(); print(LH.tostring(ul, encoding="unicode")[:500] if ul is not None else "none")
print()
print("=== last-updated markers in any page ===")
for f in list(Path("_probe/pages").glob("*.html"))[:3]:
    t=Path(f).read_text(encoding="utf-8")
    print(f.name, [m for m in re.findall(r'最后更新[^<]{0,30}|Last updated[^<]{0,30}', t)][:3])
print("=== scriptinteraction ===")
print(clean(doc_root("_probe/pages/introduction__scriptinteraction.html").text_content())[:900])
