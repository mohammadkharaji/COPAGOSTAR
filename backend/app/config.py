import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get('SR_DATA_DIR', ROOT / 'data'))
RAW_DIR = Path(os.environ.get('SR_RAW_DIR', DATA_DIR / 'raw'))
DB_PATH = Path(os.environ.get('SR_DB_PATH', DATA_DIR / 'sr.duckdb'))
# Mirrors the model's "Promosion Kala" measure, which still points at 1404 sources (zero for 1405 data).
PROMO_KALA_SOURCES = ("SRPromotionsProcedure1404", "SRPromotionsProcedure1404Chain")
# Extra non-working days as Jalali dates, e.g. SR_HOLIDAYS="1405/08/05,1405/08/12". Fridays are always off.
HOLIDAYS = tuple(x.strip() for x in os.environ.get("SR_HOLIDAYS", "").split(",") if x.strip())

CORES ={'kg': 'کوپا گستر', 'ch': 'زنجیره ای'}
DEFAULT_CORE = 'kg'
