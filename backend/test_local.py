import parsers

with open("test_data/sample-100.eml", "rb") as f:
    content = f.read()

res = parsers.parse_eml(content)
print("Keys:", res.keys())
print("Indicators:", len(res["indicators"]))
print(res["indicators"])
