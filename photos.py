#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
מושך תמונות לכל מי שמופיע באתר.

    python3 photos.py

בנתוני הכנסת אין תמונות. ויקיפדיה כן מחזיקה אותן, וגם תקציר קצר.
הסקריפט מושך לכל ח"כ בכנסתות 22-25 ולכל מועמד, ושומר photos.json:

    {"965": {"img": "...", "url": "...", "sum": "..."}, ...}

בקשות מרוכזות של 40 שמות, עם כיבוד חסימת קצב. כמה דקות.
מריצים מתוך תיקיית site.
"""
import json, os, re, sqlite3, sys, time
try:
    import requests
except ImportError:
    sys.exit("pip install requests")

WIKI = "https://he.wikipedia.org/w/api.php"
UA = {"User-Agent": "knesset-transparency/1.0"}
DB = next((p for p in ("knesset_web.db",
                       "/storage/emulated/0/Download/site/knesset_web.db")
           if os.path.exists(p)), None)
if not DB: sys.exit("לא מצאתי knesset_web.db. הריצי מתוך תיקיית site.")
OUT = os.path.join(os.path.dirname(os.path.abspath(DB)), "photos.json")



# ערך על אדם, או לא. בלי הבדיקה הזו חיפוש על "חיים כ\"ץ" החזיר
# את הערך של האות כ' באלפבית, כולל התמונה שלה.
NOT_PERSON = re.compile(r"היא האות|הוא האות|האות ה-\d+|ערך זה עוסק|"
                        r"עשוי להתייחס|פירושונים|היא מפלגה|הוא יישוב|"
                        r"הוא ארגון|היא עיר|הוא סרט|הוא ספר")
PERSON = re.compile(r"נולדה?\s|הוא פוליטיקאי|היא פוליטיקאית|הוא איש|היא אשת|"
                    r"חבר הכנסת|חברת הכנסת|הוא ישראלי|היא ישראלית|"
                    r"הוא עורך|היא עורכת|הוא רב|שירת|כיהן|כיהנה")


def is_person(extract, title=""):
    e = extract or ""
    if NOT_PERSON.search(e[:300]): return False
    if len(title) <= 2: return False
    return bool(PERSON.search(e[:400]))


def req(params, tries=4):
    for a in range(tries):
        try:
            r = requests.get(WIKI, params=params, headers=UA, timeout=90)
        except Exception as e:
            print(f"   ! {str(e)[:60]}"); time.sleep(2 ** a); continue
        if r.status_code == 429:
            w = int(r.headers.get("Retry-After") or 5 * (a + 1))
            print(f"   חסימת קצב, ממתין {w}ש׳"); time.sleep(w); continue
        if r.status_code != 200:
            print(f"   ! HTTP {r.status_code}"); return None
        try:
            j = r.json()
        except Exception:
            return None
        if "error" in j:
            print(f"   ! {str(j['error'])[:90]}"); return None
        return j
    return None


db = sqlite3.connect(DB)
people = {}
for pid, nm in db.execute("""SELECT person_id, name FROM mk
    WHERE knesset IN (SELECT DISTINCT knesset FROM vote_x)
    GROUP BY person_id"""):
    people[nm] = pid
print(f"▸ {len(people)} ח\"כים בכנסתות שבאתר")

# מועמדים שכבר יש להם תמונה מ-candidates.json
have = {}
cp = os.path.join(os.path.dirname(OUT), "candidates.json")
if os.path.exists(cp):
    for r in json.load(open(cp, encoding="utf-8")).get("rows", []):
        w = r.get("wiki") or {}
        if r.get("person_id") and w.get("img"):
            have[str(r["person_id"])] = {"img": w["img"], "url": w.get("url"),
                                         "sum": (w.get("summary") or "")[:400]}
    print(f"   {len(have)} כבר יש מקובץ המועמדים")

old = {}
if os.path.exists(OUT):
    old = json.load(open(OUT, encoding="utf-8"))
    print(f"   {len(old)} כבר בקובץ קיים")
have = {**old, **have}

need = [n for n, p in people.items() if str(p) not in have]
print(f"▸ מושך {len(need)}")
found = 0
for i in range(0, len(need), 40):
    chunk = need[i:i + 40]
    j = req({"action": "query", "format": "json", "formatversion": 2,
             "prop": "extracts|pageimages|info", "inprop": "url",
             "exintro": 1, "explaintext": 1, "piprop": "thumbnail",
             "pithumbsize": 400, "redirects": 1, "titles": "|".join(chunk)})
    if not j: continue
    qy = j.get("query", {})
    back = {}
    for k in ("normalized", "redirects"):
        for m in qy.get(k, []): back[m.get("to")] = m.get("from")
    for p in qy.get("pages", []):
        if p.get("missing"): continue
        asked = p.get("title")
        while asked in back: asked = back[asked]
        pid = people.get(asked)
        if not pid: continue
        img = (p.get("thumbnail") or {}).get("source")
        ex = re.sub(r"\s+", " ", (p.get("extract") or "")).strip()
        if not img and len(ex) < 30: continue
        if ex and not is_person(ex, p.get("title", "")):
            print(f"   דילוג: '{asked}' — הערך אינו על אדם"); continue
        have[str(pid)] = {"img": img, "url": p.get("fullurl"), "sum": ex[:400]}
        found += 1
    print(f"   {min(i + 40, len(need))}/{len(need)} · נמצאו {found}", flush=True)
    time.sleep(0.8)

# מי שלא נמצא בשם המדויק: חיפוש. השם בכנסת רשמי ומלא
# ("דסטה גדי יברקן") והערך בוויקיפדיה מקוצר ("גדי יברקן").
still = [n for n, p in people.items() if str(p) not in have]
if still:
    print(f"\n▸ מחפש {len(still)} שלא נמצאו בשם המדויק")
    for i, n in enumerate(still, 1):
        j = req({"action": "query", "format": "json", "formatversion": 2,
                 "generator": "search", "gsrsearch": n, "gsrlimit": 1,
                 "prop": "extracts|pageimages|info", "inprop": "url",
                 "exintro": 1, "explaintext": 1, "piprop": "thumbnail",
                 "pithumbsize": 400})
        pg = ((j or {}).get("query") or {}).get("pages") or []
        if pg:
            p0 = pg[0]
            img = (p0.get("thumbnail") or {}).get("source")
            ex = re.sub(r"\s+", " ", (p0.get("extract") or "")).strip()
            if not is_person(ex, p0.get("title", "")):
                continue          # תוצאת חיפוש שאינה ערך על אדם
            if img or len(ex) >= 30:
                have[str(people[n])] = {"img": img, "url": p0.get("fullurl"),
                                        "sum": ex[:400], "via": "search"}
                found += 1
        if i % 10 == 0: print(f"   {i}/{len(still)} · נמצאו {found}", flush=True)
        time.sleep(1.1)

json.dump(have, open(OUT, "w", encoding="utf-8"), ensure_ascii=False,
          separators=(",", ":"))
withimg = sum(1 for v in have.values() if v.get("img"))
print(f"\n\u2713 {OUT}  ({os.path.getsize(OUT)/1024:.0f} KB)")
print(f"   {len(have)} רשומות · {withimg} עם תמונה")
