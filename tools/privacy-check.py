import os
import re
import sys

FORBIDDEN_PATTERNS = [
    (r"C:[\\/]Users[\\/][a-zA-Z0-9_-]+", "Local Windows User Path"),
    (r"DESKTOP-[A-Z0-9]+", "Machine Hostname"),
    (r"Ahmed Maki\b", "Old Spelling of Author Name (should be Ahmed Maky)"),
    (r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", "UUID / Conversation ID"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub Personal Access Token"),
    (r"-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----", "Private Key"),
    (r"mychrome-private\.pem", "Private Key Reference"),
]

IGNORED_DIRS = {".git", "node_modules", "dist", "source_extract_temp"}
IGNORED_FILES = {
    "mychrome-v5.0.0.zip",
    "privacy-check.py",
}

findings = []

for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
    for file in files:
        if file in IGNORED_FILES or file.endswith((".png", ".jpg", ".jpeg", ".woff2", ".ico")):
            continue
        filepath = os.path.join(root, file)
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                for line_idx, line in enumerate(f, 1):
                    for pattern, desc in FORBIDDEN_PATTERNS:
                        m = re.search(pattern, line, re.IGNORECASE)
                        if m:
                            matched_str = m.group(0)
                            # Allow dummy mock UUIDs in test files
                            if "test" in filepath and matched_str in ("11111111-2222-4333-8444-555555555555", "99999999-8888-4777-8666-555555555555"):
                                continue
                            findings.append((filepath, line_idx, desc, matched_str, line.strip()[:100]))
        except Exception as e:
            pass

print(f"Total findings: {len(findings)}")
for f in findings:
    print(f"  {f[0]}:{f[1]} [{f[2]}] -> '{f[3]}' in: {f[4]}")

if findings:
    sys.exit(1)
else:
    print("ALL CLEAN! Zero privacy issues found.")
    sys.exit(0)
