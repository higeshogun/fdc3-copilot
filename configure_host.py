import json
import os
import sys

# Configuration
if len(sys.argv) > 1:
    ext_id = sys.argv[1]
else:
    print("Enter your Chrome Extension ID (found in chrome://extensions):")
    ext_id = input("> ").strip()

if not ext_id:
    print("Error: Extension ID is required.")
    sys.exit(1)

# Dynamic Base Directory (Assuming script is run from project root or its own folder)
# We assume this script is in project_root.
base_dir = os.path.dirname(os.path.abspath(__file__))

host_dir = os.path.join(base_dir, "analyst", "host")
json_path = os.path.join(host_dir, "com.interop.ai.lab.json")
reg_path = os.path.join(base_dir, "analyst", "install_host.reg")

# 1. Write JSON Manifest
manifest = {
    "name": "com.interop.ai.lab",
    "description": "FDC3 Session Analyst Host",
    "path": "host.bat",
    "type": "stdio",
    "allowed_origins": [
        f"chrome-extension://{ext_id}/"
    ]
}

with open(json_path, 'w') as f:
    json.dump(manifest, f, indent=4)

print(f"Generated {json_path}")

# 2. Write Registry File
# Path in reg file needs double backslashes
json_path_escaped = json_path.replace("\\", "\\\\")

reg_content = f"""Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Google\Chrome\\NativeMessagingHosts\com.interop.ai.lab]
@="{json_path_escaped}"
"""

with open(reg_path, 'w') as f:
    f.write(reg_content)

print(f"Generated {reg_path}")
