
import lxml.html as LH, sys, re
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
def load(n):
    doc = LH.fromstring(Path("_probe/pages/"+n).read_text(encoding="utf-8"))
    return doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')[0]
def sec(root, tag, title):
    hs=[x for x in root.xpath('.//'+tag) if " ".join(x.text_content().replace("\u200b","").split())==title]
    h=hs[0]; out=[]; n=h.getnext()
    while n is not None and n.tag not in ("h1","h2","h3"):
        out.append(LH.tostring(n, encoding="unicode")); n=n.getnext()
    return re.sub(r'data-v-[0-9a-f]+=""\s*','', "".join(out))

r = load("apis__global.html")
print("### global h1:", " ".join(r.xpath('.//h1')[0].text_content().split()))
for t in [ " ".join(x.text_content().replace("\u200b","").split()) for x in r.xpath('.//h2')[:4]]:
    print("H2:", t)
print("--- sample section of global:")
h2s=[ " ".join(x.text_content().replace("\u200b","").split()) for x in r.xpath('.//h2')]
print(sec(r,"h2",h2s[0])[:1200])
print()
print("### triggerevent h2/h3 sample")
r2 = load("apis__triggerevent.html")
print("H1:", " ".join(r2.xpath('.//h1')[0].text_content().split()) if r2.xpath('.//h1') else "(none)")
print("H2s:", [ " ".join(x.text_content().replace("\u200b","").split())[:40] for x in r2.xpath('.//h2')][:14])
h3s=[ " ".join(x.text_content().replace("\u200b","").split()) for x in r2.xpath('.//h3')]
print("H3 first 8:", h3s[:8])
print(sec(r2,"h3",h3s[0])[:1500])
