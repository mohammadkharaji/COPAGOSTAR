import re
_TRANSLATION = str.maketrans({'ي':'ی','ى':'ی','ك':'ک','ۀ':'ه','ة':'ه','ؤ':'و','إ':'ا','أ':'ا','ـ':'','‌':' ','‏':''})
def normalize_text(value):
    if value is None: return None
    value = re.sub(r'\s+', ' ', str(value).translate(_TRANSLATION)).strip()
    return value or None
def normalize_code(value): return str(value).strip() or None if value is not None else None
