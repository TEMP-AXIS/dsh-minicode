
import lxml.html as LH, sys, re
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
doc = LH.fromstring(Path("_probe/pages/apis__actor.html").read_text(encoding="utf-8"))
root = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')[0]
heads = root.xpath('.//h2')
# find GetItemId heading and print following siblings raw html until next h2
h = [x for x in heads if x.text_content().replace("\u200b","").strip()=="GetItemId"][0]
out=[]
n = h.getnext()
while n is not None and n.tag != "h2":
    out.append(LH.tostring(n, encoding="unicode"))
    n = n.getnext()
s = "".join(out)
print(len(s))
print(re.sub(r'data-v-[0-9a-f]+=""\s*','',s)[:4000])
