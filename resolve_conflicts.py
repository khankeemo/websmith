import os
import re

def resolve_conflicts(file_path):
    """Resolve git merge conflicts by accepting both changes"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to match conflict markers
        conflict_pattern = re.compile(
            r'<<<<<<< .*?\n(.*?)=======\n(.*?)>>>>>>> .*?\n',
            re.DOTALL
        )
        
        def merge_both(match):
            """Keep both versions, removing duplicates"""
            version1 = match.group(1).strip()
            version2 = match.group(2).strip()
            
            # If they're identical, keep only one
            if version1 == version2:
                return version1 + '\n'
            
            # Otherwise, keep both (version1 first, then version2)
            return version1 + '\n' + version2 + '\n'
        
        # Replace all conflicts
        resolved_content = conflict_pattern.sub(merge_both, content)
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(resolved_content)
        
        print(f"✓ Resolved: {file_path}")
        return True
    except Exception as e:
        print(f"✗ Error resolving {file_path}: {e}")
        return False

# List of conflicted files
conflicted_files = [
    'app/client/projects/page.tsx',
    'app/client/tickets/page.tsx',
    'app/clients/page.tsx',
    'app/dashboard/page.tsx',
    'app/developer/dashboard/page.tsx',
    'app/developer/profile/page.tsx',
    'app/developer/projects/page.tsx',
    'app/projects/components/ProjectCard.tsx',
    'app/projects/page.tsx',
    'components/layout/Sidebar.tsx',
    'core/services/userService.ts',
]

# Resolve each file
base_path = r'f:\PRojects\WSD\websmith'
resolved_count = 0

for file in conflicted_files:
    file_path = os.path.join(base_path, file)
    if os.path.exists(file_path):
        if resolve_conflicts(file_path):
            resolved_count += 1
    else:
        print(f"⚠ File not found: {file_path}")

print(f"\n✅ Successfully resolved {resolved_count}/{len(conflicted_files)} files")
