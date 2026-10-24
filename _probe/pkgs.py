
import struct, json, sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\mi\AppData\Local\Programs\DeepSeek Harness\resources\app.asar"
f=open(p,"rb"); vals=struct.unpack("<4I", f.read(16)); f.seek(12)
jlen=struct.unpack("<I", f.read(4))[0]; hdr=json.loads(f.read(jlen).decode("utf-8"))
tops = hdr["files"]["dsh"]["files"]["node_modules"]["files"]["@deepseek-ai"]["files"]
names = sorted(tops.keys())
print(len(names))
for n in names: print(n)
