
import struct, json, sys, mmap, re
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\mi\AppData\Local\Programs\DeepSeek Harness\resources\app.asar"
f=open(p,"rb"); vals=struct.unpack("<4I", f.read(16)); data_start=8+vals[1]
f.seek(12); jlen=struct.unpack("<I", f.read(4))[0]; hdr=json.loads(f.read(jlen).decode("utf-8"))
files=[]
def walk(node, prefix):
    for k,v in node.get("files",{}).items():
        pp=prefix+"/"+k
        if "files" in v: walk(v,pp)
        else: files.append((data_start+int(v.get("offset",0)), int(v.get("size",0)), pp))
walk(hdr,"")
files.sort()
import bisect
starts=[x[0] for x in files]
mm=mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
pat = sys.argv[1].encode()
res={}
i=0; n=0
while True:
    j = mm.find(pat, i)
    if j<0: break
    n+=1; i=j+1
    k = bisect.bisect_right(starts, j)-1
    if k>=0 and files[k][2].endswith((".js",".ts",".md")):
        res.setdefault(files[k][2], []).append(j-files[k][0])
print("matches:", n, "files:", len(res))
for path, offs in list(res.items())[:40]:
    print(len(offs), path)
