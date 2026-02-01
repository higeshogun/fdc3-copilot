import json
import os
import sys

# Configuration
ext_id = "nodaoclodcflmbjknlmochcicdkjndbk"
# Use raw string for Windows paths to avoid escape sequence errors
base_dir = r"c:\interop io intelligence\interop io intelligence\interop-ai-lab"

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
