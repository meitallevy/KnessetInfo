#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""מרכיב את candidates.json ואת photos.json בתוך המאגר.

הקבצים האלה נגזרים, לא נכתבים ביד: candidates.json נבנה מתוך
lists26.py, מתוך ה-DB שכבר במאגר, ומתוך candidates.json הקודם
ששומר את הפרופילים שנאספו. לכן אין טעם להעביר 362KB — מספיק
להעביר את המקורות ולתת לבנייה לרוץ כאן.

    python3 apply_update.py

הסקריפטים מצפים לתיקיית site/; במאגר הכל יושב בשורש, ולכן
נבנית כאן תיקייה זמנית שמצביעה על אותם קבצים.
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, "site")


def run(script):
    r = subprocess.run([sys.executable, script], cwd=ROOT,
                       capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.returncode:
        sys.stderr.write(r.stderr)
        raise SystemExit(f"{script} נכשל")


# ── 1. סביבה שבה הסקריפטים מוצאים את מה שהם מחפשים
os.makedirs(SITE, exist_ok=True)
# ה-DB גדול ולכן מקושר; candidates.json מועתק, כי הוא גם הקלט
# (שממנו נשמרים הפרופילים) וגם הפלט.
db = os.path.join(ROOT, "knesset_web.db")
if os.path.exists(db) and not os.path.exists(os.path.join(SITE, "knesset_web.db")):
    try:
        os.link(db, os.path.join(SITE, "knesset_web.db"))
    except OSError:
        shutil.copy(db, os.path.join(SITE, "knesset_web.db"))
cand = os.path.join(ROOT, "candidates.json")
if os.path.exists(cand):
    shutil.copy(cand, os.path.join(SITE, "candidates.json"))

# ── 2. הרשימות הרשמיות → candidates.json
run("build_cand.py")

# ── 3. התיאורים שנאספו, כבר מותאמים לרשימה ולמקום
path = os.path.join(SITE, "candidates.json")
doc = json.load(open(path, encoding="utf-8"))
by_pos = {(r["list"], r["pos"]): r for r in doc["rows"]}
bios = json.load(open(os.path.join(ROOT, "bios26.json"), encoding="utf-8"))
ORIGIN = "תיאור ממצפן הבחירה (bhirot26.online) — אינו מקור רשמי"
added = 0
for b in bios:
    r = by_pos.get((b["l"], b["p"]))
    if not r:
        print(f"   ! אין שורה ל-{b['l']} {b['p']}")
        continue
    pr = r.setdefault("profile", {})
    if pr.get("desc"):
        continue
    pr["desc"] = b["d"]
    pr["origin"] = ORIGIN
    added += 1
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False,
          separators=(",", ":"))
print(f"▸ {added} תיאורים הוחלו")

# ── 4. תמונות: המאגר קובע, נוספות רק רשומות חסרות
PAT = "https://fs.knesset.gov.il/globaldocs/MK/{0}/1_{0}_3_50.jpeg"
pp = os.path.join(ROOT, "photos.json")
photos = json.load(open(pp, encoding="utf-8")) if os.path.exists(pp) else {}
# אותו כלל שבנה את הקובץ מלכתחילה: לכל מי שכיהן בכנסות שבאתר
# ואין לו תמונה, הכתובת הקבועה של אתר הכנסת לפי מזהה האדם.
# מי שכבר יש לו תמונה בקובץ נשאר כפי שהוא.
import sqlite3
db = sqlite3.connect(os.path.join(ROOT, "knesset_web.db"))
people = [str(r[0]) for r in db.execute(
    """SELECT person_id FROM mk
       WHERE knesset IN (SELECT DISTINCT knesset FROM vote_x)
       GROUP BY person_id""")]
new = filled = 0
for k in people:
    if (photos.get(k) or {}).get("img"):
        continue
    if k in photos:
        photos[k] = {**photos[k], "img": PAT.format(k), "img_src": "knesset"}
        filled += 1
    else:
        photos[k] = {"img": PAT.format(k), "img_src": "knesset"}
        new += 1
json.dump(photos, open(pp, "w", encoding="utf-8"), ensure_ascii=False,
          separators=(",", ":"))
print(f"▸ תמונות: {new} חדשות, {filled} הושלמו, {len(photos)} סה\"כ")

# ── 5. הקבצים חוזרים לשורש, והתיקייה הזמנית נמחקת
shutil.copy(path, os.path.join(ROOT, "candidates.json"))
shutil.rmtree(SITE, ignore_errors=True)
print("✓ candidates.json ו-photos.json עודכנו")
