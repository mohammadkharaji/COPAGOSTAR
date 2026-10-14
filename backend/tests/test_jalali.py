from datetime import date
from app.jalali import jalali_to_gregorian, gregorian_to_jalali, parse_jdate

def test_workbook_anchor():
    assert jalali_to_gregorian(1405,7,19)==date(2026,10,11)
    assert gregorian_to_jalali(date(2026,10,11))==(1405,7,19)
def test_known_anchors():
    assert jalali_to_gregorian(1403,1,1)==date(2024,3,20)
    assert jalali_to_gregorian(1399,12,30)==date(2021,3,20)
def test_parse_invalid():
    assert parse_jdate('1405/07/18')==(1405,7,18)
    assert parse_jdate('1405/13/01') is None
