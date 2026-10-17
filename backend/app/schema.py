# Raw model column -> fact column. Phone/address columns are deliberately absent (PII).
COLUMN_MAP = {
    "SR[ID]": "row_id", "SR[ProductName]": "product_name", "SR[Brand]": "brand", "SR[MainUnit]": "main_unit",
    "SR[InvoiceCode]": "invoice_code", "SR[Year/Month]": "year_month", "SR[InvoiceDate]": "invoice_date",
    "SR[CustomerCode]": "customer_code", "SR[CustomerName]": "customer_name", "SR[Visitor]": "visitor",
    "SR[VisitorCode]": "visitor_code", "SR[Superviser]": "supervisor", "SR[Branch]": "branch",
    "SR[BranchCode]": "branch_code", "SR[Movaze]": "distributor", "SR[Mantaghe]": "region",
    "SR[CityName]": "city_name", "SR[State]": "state", "SR[Guild]": "guild",
    "SR[SalesPointName]": "sales_point_name", "SR[GROUP]": "group_name", "SR[گرید بندی]": "grade",
    "SR[طبقه حساب مشتری]": "account_class", "SR[SalesType]": "sales_type", "SR[IsFormal]": "is_formal",
    "SR[UniqueProductCode]": "unique_product_code", "SR[ProductCodeOrginal]": "product_code",
    "SR[Status]": "status", "SR[SourceTable]": "source_table", "SR[RecordKind]": "record_kind", "SR[Core]": "core",
    "SR[Rial+Vat]": "rial_vat", "SR[QTY]": "qty", "SR[Total]": "total", "SR[Tax]": "tax", "SR[Toll]": "toll",
    "SR[TotalDiscount]": "total_discount", "SR[DISCOUNT]": "discount",
    "SR[TotalDiscountBySettlementInInvoiceRecord]": "settlement_discount",
}
NUMERIC = ("rial_vat", "qty", "total", "tax", "toll", "total_discount", "discount", "settlement_discount")
TEXT = tuple(c for c in COLUMN_MAP.values() if c not in NUMERIC)

# Product dimension (product.tsv, extracted from the model's Product table) -> dim_product. main_group/sub_group are
# copied onto fact_sales (joined by unique_product_code) so they filter like any other fact column.
PRODUCT_FILE = "product.tsv"
PRODUCT_MAP = {"Product[UniqueProductCode]": "unique_product_code", "Product[گروه کالای اصلی]": "main_group",
               "Product[ProductGroup]": "sub_group"}
PRODUCT_DIMS = ("main_group", "sub_group")

LIMITATIONS = [
    {"code": "NO_COGS", "severity": "blocked", "label": "بهای تمام‌شده در مدل داده وجود ندارد؛ سود ناخالص قابل محاسبه نیست"},
    {"code": "NO_RETURNS_140501_140502", "severity": "warning", "label": "مرجوعی فروردین و اردیبهشت در منبع وجود ندارد"},
    {"code": "STALE_PROMO_MEASURE", "severity": "warning", "label": "Measure پروموشن در مدل به منبع ۱۴۰۴ اشاره می‌کند"},
    {"code": "PII_EXCLUDED", "severity": "info", "label": "تلفن و نشانی مشتری وارد لایه تحلیلی نشده است"},
]
