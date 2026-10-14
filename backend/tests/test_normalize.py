from app.normalize import normalize_text, normalize_code
def test_text(): assert normalize_text('  ساير‌  ')=='سایر' and normalize_text('كالا ي')=='کالا ی'
def test_code(): assert normalize_code('0000430039')=='0000430039'
