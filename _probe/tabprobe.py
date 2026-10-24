
import re,glob,os,sys
sys.stdout.reconfigure(encoding="utf-8")
for f in sorted(glob.glob("_probe/pages/*.html")):
    h=open(f,encoding="utf-8").read()
    # find tables
    tabs=re.findall(r"<table>(.*?)</table>",h,re.S)
    numeric=0
    for t in tabs:
        rows=re.findall(r"<tr>(.*?)</tr>",t,re.S)
        nums=0
        for r in rows:
            cells=re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>",r,re.S)
            if cells:
                first=re.sub(r"<[^>]+>","",cells[0]).strip()
                if re.fullmatch(r"\d{1,6}",first): nums+=1
        if nums>=3: numeric+=1
    if numeric: print(os.path.basename(f), "tables",len(tabs), "numeric-first-col tables", numeric)
