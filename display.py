# -*- coding: utf-8 -*-
"""שם לתצוגה מתוך שם ההגשה.

ועדת הבחירות מפרסמת "אלטשולר עדי". בעברית מדברים הפוך, אבל
אי אפשר פשוט להפוך: ב"אטיאס מויאל נטע" שם המשפחה כפול,
וב"הכהן רבין חיימוב יצחק חי רפאל" אי אפשר לדעת איפה הגבול.

לכן בונים לקסיקון שמות פרטיים מתוך שמות הח"כים במאגר —
מילה שמופיעה הרבה בהתחלה ומעט בסוף היא שם פרטי — והופכים
רק כששני תנאים מתקיימים: הסיומת כולה שמות פרטיים מוכרים,
והמילה שלפניה היא שם משפחה מוכר (או שיש בסך הכול שתי מילים).
בכל מקרה אחר נשאר שם ההגשה כפי שהוא.
"""
import collections
from match import toks, norm


def lexicon(names):
    first, last = collections.Counter(), collections.Counter()
    for nm in names:
        t = toks(nm)
        if len(t) >= 2:
            first[t[0]] += 1
            last[t[-1]] += 1
    given = {w for w, c in first.items() if c >= 2 * last.get(w, 0) + 1}
    return given, last


def display(official, given, surnames):
    # המילים המקוריות לתצוגה, המנורמלות רק לחיפוש בלקסיקון.
    # בלי ההפרדה הזו "ליכטנשטיין" חוזר כ"ליכטנשטין".
    raw = official.split()
    t = [norm(w) for w in raw]
    if len(raw) < 2 or any(not x for x in t):
        return official
    if t[0] in given and t[-1] not in given:
        return official                      # כבר בסדר הרגיל
    k = 0
    while k < len(t) - 1 and t[len(t) - 1 - k] in given:
        k += 1
    if not k:
        return official
    if len(t) == 2 or surnames.get(t[len(t) - 1 - k], 0) > 0:
        return " ".join(raw[len(raw) - k:] + raw[:len(raw) - k])
    return official
