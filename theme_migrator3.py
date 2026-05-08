import os, glob, re

for filepath in glob.glob("src/**/*.tsx", recursive=True):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace stone with slate
    content = re.sub(r"stone-(\d+)", r"slate-\1", content)
    content = re.sub(r"amber-950", r"slate-900", content)
    content = re.sub(r"amber-900", r"slate-800", content)
    content = re.sub(r"amber-800", r"slate-700", content)
    content = re.sub(r"amber-700", r"slate-600", content)
    content = re.sub(r"amber-600", r"slate-500", content)
    content = re.sub(r"amber-500", r"slate-400", content)
    content = re.sub(r"amber-400", r"slate-300", content)
    content = re.sub(r"amber-300", r"slate-200", content)
    content = re.sub(r"amber-200", r"slate-200", content)
    content = re.sub(r"amber-100", r"slate-100", content)
    content = re.sub(r"amber-50", r"slate-50", content)
    # Be careful not to replace text containing "orange" like the word orange, but `orange-\d+` is fine
    content = re.sub(r"orange-(\d+)", r"slate-\1", content)
    
    # Check for hardcoded old background brown
    replacements = {
        "#f7f3ed": "#eef3f4",
        "#efe6da": "#e4ebea",
        "#f8f5ef": "#eef3f4",
        "#faf7f2": "#f4f8f8",
        "#efe7db": "#e6edec",
        "#f8f4ee": "#edf3f4",
        "#f2ece3": "#dbe7e7",
        "bg-[#f8f5ef]": "bg-[#eef3f4]",
        "bg-[#efe6da]": "bg-[#e4ebea]",
        "rgba(63,40,12,": "rgba(24,32,40,",
        "rgba(97,74,42,": "rgba(43,58,68,",
        "shadow-[0_30px_90px_-48px_rgba(63,40,12,0.45)]": "shadow-[0_30px_90px_-48px_rgba(24,32,40,0.45)]",
    }
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
print("done")

