with open(r'D:\websmith\app\internal\publisher\runtimes\python.ts', 'r') as f:
    content = f.read()

import re
match = re.search(r"'universal_license_center\.py': `([\s\S]*?)`,", content)
if match:
    template = match.group(1)
    lines = template.split('\n')
    for i, line in enumerate(lines[28:32], 29):
        print(f'{i}: {repr(line)}')