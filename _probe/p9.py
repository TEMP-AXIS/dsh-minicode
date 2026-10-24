
import lxml.html as LH, sys, re, json, statistics, io
sys.stdout.reconfigure(encoding="utf-8")
src = io.open("_probe/p5.py", encoding="utf-8").read().split('print("FUNCS"')[0]
exec(src)
def sig(e, with_desc=True):
    p=", ".join("%s:%s"%(x["name"] or "_", x["type"] or "?") for x in e["params"] if x["name"])
    r=", ".join("%s:%s"%(x["name"] or "_", x["type"] or "?") for x in e["returns"] if x["name"]) or "nil"
    return "%s:%s(%s) -> %s%s" % (e["page"].replace("apis__","").replace(".html",""), e["name"], p, r, (" · "+e["note"][:40]) if with_desc else "")
L0 = "\n".join(sig(e) for e in funcs); L0b="\n".join(sig(e,False) for e in funcs)
print("L0 sig+desc chars:", len(L0), "| sig only:", len(L0b))
print("sample:", L0.split("\n")[0])
print("sample:", [l for l in L0.split("\n") if l.startswith("actor:SetTeam")][0])
cards=[len(json.dumps(e, ensure_ascii=False)) for e in funcs]
print("avg card JSON chars:", int(statistics.mean(cards)), "max:", max(cards), "all cards:", sum(cards))
actor=[e for e in funcs if e["page"]=="apis__actor.html"]
print("Actor sheet chars:", len("\n".join(sig(e) for e in actor)), "entries:", len(actor))
