
import json,re,sys
sys.stdout.reconfigure(encoding="utf-8")
d=json.load(open("data/ugc-wiki.json",encoding="utf-8"))
LABELS=["方块ID","道具ID","音效ID","特效ID","生物ID","粒子特效ID","资源ID","动画ID","模型ID","UI ID","界面ID","皮肤ID","按钮ID","控件ID","图标ID","贴图ID","BuffID","buffID","buff id","技能ID","区域ID","变量ID","元件ID"]
cnt={}
samples=[]
for rec in d["apis"]:
    ex=rec.get("example") or ""
    if not ex: continue
    for line in ex.split("\n"):
        for lab in LABELS:
            if lab in line:
                nums=re.findall(r"\b\d{1,6}\b",line)
                if nums:
                    cnt[lab]=cnt.get(lab,0)+len(nums)
                    if len(samples)<12: samples.append((rec["id"],lab,line.strip()[:120]))
print(json.dumps(cnt,ensure_ascii=False,indent=1))
print(len(samples))
for s in samples: print(s)
# prose docs
total=0
for doc in d["docs"]:
    for sec in doc.get("sections") or []:
        for m in re.finditer(r"(\d{1,6})\s*是\s*([\u4e00-\u9fffA-Za-z]{2,6}ID)",sec.get("text") or ""):
            total+=1
print("prose 是XID statements:",total)
