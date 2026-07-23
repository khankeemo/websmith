import re

with open(r'D:\websmith\app\internal\publisher\runtimes\python.ts', 'r') as f:
    content = f.read()

# Find the universal_license_center.py template
match = re.search(r"'universal_license_center\.py': `([\s\S]*?)`,", content)
if match:
    template = match.group(1)
    lines = template.split('\n')
    print('=== universal_license_center.py imports (first 25 lines) ===')
    for i, line in enumerate(lines[:25], 1):
        print(f'{i}: {line}')
    print()
    print('=== ttk.Combobox usage ===')
    for i, line in enumerate(lines, 1):
        if 'ttk' in line or 'Combobox' in line:
            print(f'{i}: {line}')
else:
    print('Template not found')