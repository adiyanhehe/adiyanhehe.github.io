import os

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # If it's already patched, skip
    if 'global.css' in content and 'global.js' in content:
        print(f"Skipping {filepath}, already patched.")
        return

    # Check if we should inject ably:
    if 'ably.min-1.js' not in content:
        injections = """
    <!-- Global Control Center via Super Admin -->
    <link rel="stylesheet" href="global.css">
    <script src="https://cdn.ably.com/lib/ably.min-1.js"></script>
    <script src="global.js" defer></script>
"""
    else:
        injections = """
    <!-- Global Control Center via Super Admin -->
    <link rel="stylesheet" href="global.css">
    <script src="global.js" defer></script>
"""

    # Inject right before </head>
    if '</head>' in content:
        content = content.replace('</head>', f"{injections}</head>")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {filepath}")
    else:
        print(f"Failed to patch {filepath}, no </head> tag.")

if __name__ == "__main__":
    directory = r"d:\adiyanhehe.github.io-main"
    for filename in os.listdir(directory):
        if filename.endswith(".html") and filename != "super-admin.html":
            filepath = os.path.join(directory, filename)
            process_file(filepath)
