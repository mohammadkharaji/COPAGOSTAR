import pathlib
out = pathlib.Path(__file__).resolve().parent.parent / "data" / "queries"
out.mkdir(parents=True, exist_ok=True)
for f in out.glob("*.dax"):
    f.unlink()
cores = {"kg": "کوپا گستر", "ch": "زنجیره ای"}
for key, core in cores.items():
    for m in range(1, 13):
        ym = f"14050{m}"
        (out / f"sr_{key}_{ym}.dax").write_text(
            f'EVALUATE FILTER(SR, SR[Core]="{core}" && SR[Year/Month]="{ym}")', encoding="utf-8")
(out / "product.dax").write_text("EVALUATE Product", encoding="utf-8")
(out / "salesunit.dax").write_text("EVALUATE SalesUnit", encoding="utf-8")
print(len(list(out.glob('*.dax'))), "queries")
