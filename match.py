# -*- coding: utf-8 -*-
"""התאמת שם מההגשה הרשמית לשם במאגר הכנסת.

שלוש צורות לאותו אדם:
    הגשה   "רגב מרים"
    מאגר   "מירי מרים רגב"
    שגור   "מירי רגב"
אין סדר קבוע, אין אורך קבוע, ויש שגיאות הקלדה בהגשה עצמה
("אינזקוט גדי"). השוואת מחרוזות לא עוזרת, וחפיפת מילים לבדה
מייצרת זיהויים שגויים: "ששון שמואל" קיבל את שמואל פלאטו-שרון,
ו"בן חיים רעות" את חיים בן-אשר, כי "שמואל", "בן" ו"חיים"
חוזרות בעשרות שמות.

לכן ההתאמה נשענת על נדירות: צריך עוגן — מילה שמופיעה במאגר
מעט פעמים והתאימה בדיוק. מילים נפוצות מצטרפות לציון אבל
לא מקימות זיהוי בעצמן.
"""
import collections
import math
import re

VAR = [("וו", "ו"), ("יי", "י"), ("’", ""), ("׳", ""), ("'", ""),
       ("\"", ""), ("״", "")]
# כינויים שאף כלל אותיות לא גושר עליהם. "אבי/אברהם" נתפס
# בכלל התחילית ולכן אינו כאן.
NICK = [("מירי", "מרים"), ("מיקי", "מיכאל"), ("בוגי", "משה"),
        ("בייגה", "אברהם"), ("פואד", "בנימין"), ("ציפי", "צפורה"),
        ("בוזי", "יצחק"), ("איציק", "יצחק"), ("יולי", "יואל"),
        ("קטי", "קתרין"), ("מוטי", "מרדכי"), ("בני", "בנימין"),
        ("ג'קי", "יעקב"), ("קיקי", "יעקב"), ("בובי", "ברוך"),
        ("סימה", "שמחה"), ("אלי", "אליהו"), ("אלי", "אלימלך"),
        ("צביקה", "צבי"), ("דודי", "דוד"), ("שולי", "שלמה"),
        ("יוסי", "יוסף"), ("אתי", "אסתר"), ("תמי", "תמר"),
        ("רפי", "רפאל"), ("גבי", "גבריאל"), ("חילי", "יחיאל"),
        ("אבו", "אבו")]
NIK = collections.defaultdict(set)
for _a, _b in NICK:
    NIK[_a].add(_b)
    NIK[_b].add(_a)

RARE = 6        # מילה שמופיעה בעד כך שמות היא נדירה — עוגן אפשרי
LONG = 6        # עוגן מטושטש מותר רק במילה ארוכה


def norm(s):
    if not s:
        return ""
    s = str(s).strip()
    for a, b in VAR:
        s = s.replace(a, b)
    s = re.sub(r"[־–—\-]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def toks(s):
    return [t for t in norm(s).split() if len(t) > 1]


def _lev1(a, b):
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) > len(b):
        a, b = b, a
    i = j = d = 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            i += 1
            j += 1
        else:
            d += 1
            if d > 1:
                return False
            if len(a) == len(b):
                i += 1
            j += 1
    return True


def same_word(a, b):
    if a == b:
        return True
    # כינוי, כולל צורת נקבה שנגזרת ממנו: "גבי" מול "גבריאלה"
    # עובר דרך "גבריאל" שבטבלה.
    for u, v in ((a, b), (b, a)):
        for x in NIK.get(u, ()):
            if x == v or (len(x) >= 4 and
                          (v.startswith(x) or x.startswith(v))):
                return True
    if len(a) >= 3 and len(b) >= 3 and (a.startswith(b) or b.startswith(a)):
        return True
    if len(a) >= 4 and len(b) >= 4 and _lev1(a, b):
        return True
    # היפוך אותיות: "אינזקוט" כפי שהוגש מול "איזנקוט" שבמאגר
    return len(a) >= 5 and len(a) == len(b) and sorted(a) == sorted(b)


class Index:
    def __init__(self, items):
        """items = [(key, name), ...]"""
        self.items, self.by = [], collections.defaultdict(list)
        self.df = collections.Counter()
        for key, name in items:
            t = toks(name)
            if not t:
                continue
            self.items.append((key, name, t))
            i = len(self.items) - 1
            for w in set(t):
                self.by[w].append(i)
                self.df[w] += 1
                if len(w) >= 4:
                    self.by[w[:3]].append(i)
        self.n = max(1, len(self.items))

    def w(self, word):
        """משקל מידע. מילה נפוצה שווה מעט."""
        return math.log(self.n / (1 + self.df.get(word, 0)))

    def _pair(self, ct, t):
        """מזווג מילים בין שני שמות. מחזיר dict עם מה שנדרש להכרעה."""
        free = list(t)
        pairs = []
        for w in ct:                           # מדויקות קודם
            if w in free:
                free.remove(w)
                pairs.append((w, w, True))
        done = {p[0] for p in pairs}
        for w in ct:
            if w in done:
                continue
            for x in list(free):
                if same_word(w, x):
                    free.remove(x)
                    pairs.append((w, x, False))
                    break
        m = len(pairs)
        exact = sum(1 for p in pairs if p[2])
        if m < 2 or exact == 0:
            return None

        # צד אחד חייב להיכנס בשלמותו בשני. "בן עמי לילי" מול
        # "משה בן-עמי" חולק שתי מילים, אבל לכל צד נשארת מילה
        # משלו — שני אנשים שחולקים שם משפחה, לא אדם אחד.
        left = [w for w in ct if w not in {p[0] for p in pairs}]
        if free and left:
            return None

        rare = lambda w: self.df.get(w, 99) <= RARE and len(w) >= 3
        rx = sum(1 for p in pairs if p[2] and rare(p[1]))
        # תמורה מדויקת: אותן מילים בדיוק, בסדר אחר. "כץ ישראל"
        # מול "ישראל כ״ץ" — שתי מילים נפוצות, ובכל זאת אין כאן
        # ניחוש. ההכרעה בין נושאי אותו שם נעשית למעלה.
        perm = len(ct) == len(t) == m and all(p[2] for p in pairs)
        soft = False
        if rx == 0 and not perm:
            # אין מילה נדירה שהתאימה בדיוק. התאמה מקורבת על מילה
            # ארוכה ונדירה עוד עשויה להיות נכונה ("אינזקוט"), אבל
            # היא גם מקור הזיהויים השגויים — ולכן מסומנת לבדיקה.
            if not any((not p[2]) and len(p[1]) >= LONG and rare(p[1])
                       for p in pairs):
                return None
            soft = True
        elif rx < 2:
            # מילה נדירה שנשארה במאגר בלי זוג פוסלת: "לביב אבו-רוכן"
            # מול "אבו רוקן כמיל" — "לביב" אינו בהגשה בשום צורה.
            for x in free:
                if rare(x) and not any(same_word(x, w) for w in ct):
                    return None
        score = sum(self.w(p[1]) * (1.0 if p[2] else 0.6) for p in pairs)
        score -= 0.25 * sum(self.w(x) for x in free)
        return {"m": m, "exact": exact, "rare": rx, "soft": soft,
                "score": score, "perm": perm, "full": not free,
                "dblen": len(t)}

    def find(self, name):
        """מחזיר את כל המועמדים בציון המקסימלי:
        [(key, name, info), ...]. יותר מאחד = שם נפוץ, הכרעה למעלה."""
        ct = toks(name)
        if not ct:
            return []
        seen, best, out = set(), None, []
        keys = set(ct) | {w[:3] for w in ct if len(w) >= 4}
        for k in keys:
            for i in self.by.get(k, ()):
                if i in seen:
                    continue
                seen.add(i)
                key, nm, t = self.items[i]
                info = self._pair(ct, t)
                if not info:
                    continue
                if best is None or info["score"] > best + 1e-9:
                    best, out = info["score"], [(key, nm, info)]
                elif abs(info["score"] - best) < 1e-9:
                    out.append((key, nm, info))
        return out
