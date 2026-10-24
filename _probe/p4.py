
import lxml.html as LH, sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
def clean(s): return " ".join(s.replace("\u200b","").split())
doc = LH.fromstring(Path("_probe/pages/apis__actor.html").read_text(encoding="utf-8"))
root = doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," vp-doc ")]')[0]
h=[x for x in root.xpath('.//h2') if clean(x.text_content())=="SetTeam"][0]
ul=h.getnext()
print(LH.tostring(ul, encoding="unicode")[:2000].replace('data-v-','D'))
