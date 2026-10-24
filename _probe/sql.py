
import sqlite3, sys
sys.stdout.reconfigure(encoding="utf-8")
print("sqlite", sqlite3.sqlite_version)
db = sqlite3.connect(":memory:")
for tok in ["unicode61","trigram","porter","simple"]:
    try:
        db.execute(f"CREATE VIRTUAL TABLE t_{tok} USING fts5(a, tokenize='{tok}')")
        print("OK tokenizer:", tok)
    except Exception as e:
        print("FAIL", tok, e)
db.execute("INSERT INTO t_trigram(a) VALUES ('获取掉落物类型ID，根据掉落物对象ID获取对应的物品类型ID')")
for q in ["掉落物", "类型ID", "itemId", "获取"]:
    try:
        rows = db.execute("SELECT * FROM t_trigram WHERE t_trigram MATCH ? ORDER BY rank", ('"'+q+'"',)).fetchall()
        print(repr(q), "→", len(rows))
    except Exception as e:
        print(repr(q), "ERR", e)
