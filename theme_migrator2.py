import re
with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

replacements = {
    # Main brown screen
    "bg-[radial-gradient(circle_at_top,_rgba(226,161,96,0.16),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(70,112,102,0.12),_transparent_28%),linear-gradient(180deg,#241913_0%,#39281d_18%,#efe4d7_18.2%,#eadfce_100%)]": "bg-[radial-gradient(circle_at_top,_rgba(112,154,169,0.18),_transparent_32%),linear-gradient(145deg,#0d1216_0%,#172028_52%,#0d1216_100%)]",
    
    # 3D block pieces
    "bg-[linear-gradient(180deg,#d7a06c_0%,#b87741_100%)]": "bg-[linear-gradient(180deg,#899fae_0%,#637c8e_100%)]",
    "border-amber-900/15": "border-slate-900/15",
    "shadow-[0_18px_30px_-20px_rgba(91,60,34,0.34)]": "shadow-[0_18px_30px_-20px_rgba(30,41,59,0.34)]",
    "bg-[linear-gradient(180deg,#c88c5b_0%,#9f6337_100%)]": "bg-[linear-gradient(180deg,#708899_0%,#4e687b_100%)]",
    "bg-[linear-gradient(180deg,#e1b381_0%,#c4864d_100%)]": "bg-[linear-gradient(180deg,#9db4c2_0%,#7994a5_100%)]",
    
    "bg-[linear-gradient(180deg,#d9a26f_0%,#b67640_100%)]": "bg-[linear-gradient(180deg,#899fae_0%,#637c8e_100%)]",
    "shadow-[0_20px_34px_-22px_rgba(91,60,34,0.34)]": "shadow-[0_20px_34px_-22px_rgba(30,41,59,0.34)]",
    "bg-[linear-gradient(180deg,#c9895b_0%,#9f6234_100%)]": "bg-[linear-gradient(180deg,#708899_0%,#4e687b_100%)]",
    "bg-[linear-gradient(180deg,#e0b182_0%,#bf8049_100%)]": "bg-[linear-gradient(180deg,#9db4c2_0%,#7994a5_100%)]",
    
    # Active/Inactive tabs turning amber
    "border-amber-200": "border-slate-300",
    "bg-amber-50/80": "bg-slate-100",
    "text-amber-800": "text-slate-800",
    "border-amber-300": "border-slate-300",
    "ring-amber-200": "ring-slate-200",
    "bg-amber-50/70": "bg-slate-50",
    "bg-amber-50": "bg-slate-50",
    "text-amber-900": "text-slate-900",
    "ring-amber-100": "ring-slate-100",
    "text-amber-950": "text-slate-950",
    "hover:bg-amber-50": "hover:bg-slate-50",
    "bg-amber-50/85": "bg-slate-100",
    "text-amber-700": "text-slate-700",
    
    # Blurs
    "bg-amber-200/20": "bg-slate-200/30",
    "bg-amber-200/40": "bg-slate-200/50",
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
print("done")

