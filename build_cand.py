#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בונה site/candidates.json מהרשימות הרשמיות של הכנסת ה-26."""
import json, os, sqlite3, sys, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lists26 import LISTS, WITHDRAWN, NOTE, ELECTION, APPROVED, SUBMITTED
from match import Index, toks
from profiles26 import PROFILES, FIX
from display import lexicon, display

SITE = "site"
DB = os.path.join(SITE, "knesset_web.db")
OUT = os.path.join(SITE, "candidates.json")
PREV = os.path.join(SITE, "candidates_prev.json")

# ── 1. מי מוכר לכנסת ──────────────────────────────────
db = sqlite3.connect(DB)
known = {}
for pid, nm, kn, fac in db.execute(
        "SELECT person_id, name, knesset, faction FROM mk ORDER BY knesset"):
    k = known.setdefault(pid, {"name": nm, "knessets": [], "last_faction": None})
    k["knessets"].append(kn)
    k["last_faction"] = fac
    k["name"] = nm
for v in known.values():
    v["knessets"] = sorted(set(v["knessets"]), reverse=True)
print(f"▸ נתוני כנסת: {len(known):,} אנשים")
kidx = Index([(pid, v["name"]) for pid, v in known.items()])

# ── 2. מה כבר נאסף ───────────────────────────────────
prev_rows, prev_by_pid = [], {}
# קודם הפלט הקיים, שהוא העשיר ביותר; PREV רק אם אין
src_file = OUT if os.path.exists(OUT) else PREV
if os.path.exists(src_file):
    for r in json.load(open(src_file, encoding="utf-8")).get("rows", []):
        if not r.get("name"):
            continue
        keep = {k: r[k] for k in ("profile", "wiki") if r.get(k)}
        if not keep:
            continue
        prev_rows.append((r["name"], keep, r.get("person_id")))
        if r.get("person_id"):
            prev_by_pid[r["person_id"]] = keep
    print(f"▸ מהקובץ הקודם: {len(prev_rows)} פרופילים, "
          f"{len(prev_by_pid)} לפי person_id")
pidx = Index([(i, p[0]) for i, p in enumerate(prev_rows)])


def pick(cands):
    """בוחר בין מועמדים שקיבלו אותו ציון, ומחזיר (מועמד, ודאי?).

    שם כמו "אלי כהן" מצביע על יותר מאדם אחד במאגר, ומי שכיהן
    לאחרונה הוא ההימור הסביר. ודאות נשללת בשני מצבים:
      * שתי מילים זהות בלבד, בלי מילה נדירה, ומי שנמצא לא כיהן
        בכנסות שבאתר — "לוי דוד" מתאים לדוד לוי משנות השמונים
        בדיוק כמו לאדם אחר באותו שם.
      * ההתאמה נשענת על דמיון ולא על זהות.
    """
    if not cands:
        return None, False
    if len(cands) > 1:
        best = max(max(known[c[0]]["knessets"]) for c in cands)
        cands = [c for c in cands
                 if max(known[c[0]]["knessets"]) == best]
        if len(cands) > 1 or best < 22:
            return cands[0], False
    pid, nm, info = cands[0]
    last = max(known[pid]["knessets"])
    if info["soft"]:
        return cands[0], False
    # מתקבל אוטומטית רק מה שחזק: מילה נדירה שהתאימה בדיוק ואדם
    # שכיהן בכנסות שבאתר, או שתי מילים נדירות ושלוש התאמות.
    # כל השאר עובר הכרעה ידנית ברשימה שלמטה — "כהן יצחק" מתאים
    # ליצחק כהן מש\"ס מצוין, ואין לזה שום קשר למי שרץ ב"משפט צדק".
    ok = (info["rare"] >= 1 and last >= 22) or \
         (info["rare"] >= 2 and info["m"] >= 3)
    return cands[0], ok


# ── הכרעות ידניות ──────────────────────────────────
# כל שורה כאן היא מקרה שהאוטומט סימן כלא־ודאי, והוכרעה בבדיקה
# מול רשימת ההגשה ומול מי שהאדם במאגר. הנימוק רשום, כדי שאפשר
# יהיה לבדוק אותי.
OK, NO = "ok", "no"
RULED = {
 # אושר: אותו אדם
 ("הליכוד", 6): (OK, "ישראל כ\"ץ, שר בליכוד"),
 ("הליכוד", 18): (OK, "חיים כ\"ץ, שר בליכוד"),
 ("הליכוד", 26): (OK, "אלי גולדשמידט, ח\"כ העבודה לשעבר, ברשימת הליכוד"),
 ("הליכוד", 40): (OK, "מאי גולן — \"בדרה גולן פלורה מאי\" בהגשה"),
 ("ישר!", 17): (OK, "רועי פולקמן, כולנו"),
 ("יהדות התורה", 2): (OK, "יצחק גולדקנופף — במאגר \"גולדקנופ\""),
 ("הציונות הדתית", 2): (OK, "משה פייגלין, זהות"),
 ("המילואימניקים והכלכלית", 3): (OK, "עינת וילף, העבודה"),
 # נדחה: אדם אחר שחולק שם
 ("הציונות הדתית", 22): (NO, "משה פלד מצומת, נולד 1935"),
 ("עוצמה יהודית", 9): (NO, "גולדברגר, לא גולדברג"),
 ("ישראל ביתנו", 13): (NO, "דוד אזולאי מש\"ס נפטר ב-2018"),
 ("המילואימניקים והכלכלית", 19): (NO, "דוד לוי נפטר ב-2024"),
 ("הפיראטים", 25): (NO, "אורן, לא אורי אור"),
 ("צבע שחור", 4): (NO, "אינו יצחק רבין"),
 ("תנועת אח\"י", 3): (NO, "ארז, לא ארזי"),
 ("תנועת אח\"י", 9): (NO, "אינו רפאל סויסה מש\"ס"),
 ("ברית עולם", 5): (NO, "אינו יעקב-שמשון שפירא"),
 ("משפט צדק", 4): (NO, "אינו יצחק כהן מש\"ס"),
}
# שיוך שההתאמה האוטומטית לא מצאה כלל
LINK = {("הליכוד", 2): ("אלי כהן", "שר החוץ, ח\"כ הליכוד")}

by_name = collections.defaultdict(list)
for pid, v in known.items():
    by_name[v["name"]].append(pid)


# ── 3. בנייה ────────────────────────────────────────
rows, meta = [], {}
for lname, L in LISTS.items():
    meta[lname] = {"letter": L["letter"], "leader": L["leader"],
                   "full": L["full"], "src": L["src"], "n": len(L["names"])}
    for pos, official in enumerate(L["names"], 1):
        rows.append({"list": lname, "pos": pos, "official": official,
                     "name": official, "verified": "none"})

# שיוך למאגר. אדם רץ ברשימה אחת, ולכן person_id מופיע פעם אחת:
# התאמה חלשה שמתנגשת בחזקה נמחקת. בלי זה "גוטרמן יעקב אשר"
# קיבל את יעקב אשר, שכבר שובץ במקום הראשון באותה רשימה.
claim = {}
for r in rows:
    key = (r["list"], r["pos"])
    got, sure = pick(kidx.find(r["official"]))
    if key in LINK:
        nm, why = LINK[key]
        ids = by_name.get(nm) or []
        if ids:
            pid = max(ids, key=lambda p: max(known[p]["knessets"]))
            got, sure = (pid, nm, {"score": 999}), True
            r["ruled"] = why
        else:
            print(f"   ! LINK נכשל: {nm}")
    elif key in RULED and got:
        verdict, why = RULED[key]
        r["ruled"] = why
        if verdict == NO:
            r["ruled_out"] = got[1]
            continue
        sure = True
    if not got:
        continue
    pid, dbname, info = got
    r["_cand"] = (pid, dbname, info["score"], sure)
    cur = claim.get(pid)
    if cur is None or info["score"] > cur[1]:
        claim[pid] = (r, info["score"])

for r in rows:
    c = r.pop("_cand", None)
    if not c:
        continue
    pid, dbname, score, sure = c
    if claim[pid][0] is not r:
        r["dup_of"] = dbname          # הפסיד בתחרות על אותו אדם
        continue
    k = known[pid]
    r.update(person_id=pid, knesset_name=dbname, knessets=k["knessets"],
             last_faction=k["last_faction"])
    if sure:
        r.update(verified="knesset", name=dbname)
    else:
        r["check"] = True

# שימור מה שנאסף בעבר. גם כאן פרופיל אחד לאדם אחד: בלי זה
# "גוטרמן יעקב אשר" ירש את הפרופיל של יעקב אשר ממקום ראשון.
pclaim = {}
taken = {r["person_id"] for r in rows if r.get("person_id")}
for r in rows:
    if r.get("dup_of"):
        continue
    if not r.get("check") and r.get("person_id") in prev_by_pid:
        r["_prev"] = ("pid", r["person_id"])
        continue
    got = [c for c in pidx.find(r["official"]) if not c[2]["soft"]]
    if len(got) != 1:
        continue
    i, pnm, info = got[0]
    # שורה קודמת ששייכת לאדם שכבר שובץ בבנייה הזו אינה עוברת
    # לאדם אחר. "כץ חיים מאיר" מיהדות התורה קיבל כך את תמונתו
    # של חיים כ\"ץ מהליכוד, רק משום ששניהם חיים כ\"ץ. אם אף שורה
    # לא תבעה את אותו person_id, הוא שריד משיוך ישן ושגוי
    # ואין בו כדי לפסול את התיאור עצמו.
    owner = prev_rows[i][2]
    if owner and owner != r.get("person_id") and owner in taken:
        continue
    r["_prev"] = ("name", i, pnm)
    if i not in pclaim or info["score"] > pclaim[i][1]:
        pclaim[i] = (r, info["score"])

for r in rows:
    p = r.pop("_prev", None)
    if not p:
        continue
    if p[0] == "pid":
        keep = prev_by_pid[p[1]]
    else:
        if pclaim[p[1]][0] is not r:
            continue
        keep = prev_rows[p[1]][1]
        r["name"] = p[2]                 # השם שהמשתמשת כבר מכירה
    r.update({k: v for k, v in keep.items() if not r.get(k)})
    if r["verified"] == "none" and r.get("wiki"):
        r["verified"] = "wikipedia"

# שם לתצוגה: "אלטשולר עדי" בהגשה, "עדי אלטשולר" בדיבור.
# official נשמר תמיד ומוצג בכרטיס, כדי שאפשר יהיה להצליב.
GIVEN, SURNAME = lexicon([v["name"] for v in known.values()])
flip = 0
for r in rows:
    if r["name"] == r["official"]:
        nm = display(r["official"], GIVEN, SURNAME)
        if nm != r["official"]:
            r["name"] = nm
            flip += 1
print(f"▸ {flip} שמות הוסבו לסדר הרגיל")

# תיאורים שנכתבו ידנית למי שאינו במאגר
added = 0
for r in rows:
    pr = PROFILES.get((r["list"], r["pos"]))
    if pr and not r.get("profile"):
        r["profile"] = dict(pr)
        added += 1
for (l, pos), f in FIX.items():
    for r in rows:
        if r["list"] == l and r["pos"] == pos and r.get("profile"):
            r["profile"].update(f)
# תמונה מאתר הכנסת נגזרת ממזהה אדם. אם המזהה אינו של השורה
# הזו, התמונה היא שריד משיוך שבוטל — ומראה אדם אחר.
drop = 0
for r in rows:
    pr = r.get("profile") or {}
    u = pr.get("img") or ""
    if "fs.knesset.gov.il" in u and f"/MK/{r.get('person_id')}/" not in u:
        pr.pop("img", None)
        drop += 1
print(f"▸ {added} תיאורים ידניים נוספו · {drop} תמונות שגויות הוסרו")

by = collections.Counter(r["verified"] for r in rows)
print(f"\n▸ {len(rows)} מועמדים ב-{len(LISTS)} רשימות · {dict(by)}")
print(f"   פרופיל: {sum(1 for r in rows if r.get('profile'))}  ·  "
      f"ויקיפדיה: {sum(1 for r in rows if r.get('wiki'))}  ·  "
      f"לבדיקה: {sum(1 for r in rows if r.get('check'))}")

json.dump({"knesset": 26, "election": ELECTION, "submitted": SUBMITTED,
           "approved": APPROVED, "source": "ועדת הבחירות המרכזית",
           "note": NOTE, "withdrawn": WITHDRAWN,
           "list_meta": meta, "lists": list(LISTS.keys()), "rows": rows},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False,
          separators=(",", ":"))
print(f"✓ {OUT}  ({os.path.getsize(OUT)/1024:.0f} KB)")
