from datetime import date, timedelta
import re
_BREAKS=(-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178)
_RE=re.compile(r'^(\d{4})/(\d{2})/(\d{2})$')
def _div(a,b): return int(a/b)
def _cal(y):
    gy=y+621; leap=-14; jp=_BREAKS[0]; jump=0
    for jm in _BREAKS[1:]:
        jump=jm-jp
        if y<jm: break
        leap += _div(jump,33)*8+_div(jump%33,4); jp=jm
    else: raise ValueError(f'Jalali year out of range: {y}')
    n=y-jp; leap += _div(n,33)*8+_div(n%33+3,4)
    if jump%33==4 and jump-n==4: leap+=1
    leap_g=_div(gy,4)-_div((_div(gy,100)+1)*3,4)-150
    march=20+leap-leap_g
    if jump-n<6: n=n-jump+_div(jump+4,33)*33
    lp=((n+1)%33-1)%4
    if lp==-1: lp=4
    return lp,gy,march
def is_leap_jalali(y): return _cal(y)[0]==0
def days_in_jalali_month(y,m): return 31 if m<=6 else 30 if m<=11 else 30 if is_leap_jalali(y) else 29
def jalali_to_gregorian(y,m,d):
    if not 1<=m<=12 or not 1<=d<=days_in_jalali_month(y,m): raise ValueError('invalid Jalali date')
    _,gy,march=_cal(y); doy=(m-1)*31-(m//7)*(m-7)+d-1
    return date(gy,3,march)+timedelta(days=doy)
def gregorian_to_jalali(g):
    y=g.year-621; _,gy,march=_cal(y); k=(g-date(gy,3,march)).days
    if k<0: y-=1; _,gy,march=_cal(y); k=(g-date(gy,3,march)).days
    elif k>=365+(1 if is_leap_jalali(y) else 0): y+=1; _,gy,march=_cal(y); k=(g-date(gy,3,march)).days
    if k<=185:return y,1+k//31,k%31+1
    k-=186; return y,7+k//30,k%30+1
def parse_jdate(text):
    m=_RE.match(text or '')
    if not m:return None
    v=tuple(map(int,m.groups()))
    try: jalali_to_gregorian(*v)
    except ValueError:return None
    return v
def format_jdate(y,m,d): return f'{y:04d}/{m:02d}/{d:02d}'
def jalali_weekday(g): return (g.weekday()+2)%7

JALALI_MONTHS = ("فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند")
JALALI_WEEKDAYS = ("شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه")
