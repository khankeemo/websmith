# Check for button issues in universal_email_dialog.py
import re

with open('universal_email_dialog.py', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

print('Checking for UI issues in universal_email_dialog.py...')
print('=' * 60)

# 1. Check for Send button (should be "Send", not "Send Email")
if 'text="Send Email"' in content:
    print('ISSUE 1: Send button says "Send Email" (should be "Send")')
else:
    print('OK: Send button text is correct')

# 2. Check for Cancel | Preview | Send label
if 'Cancel | Preview | Send' in content:
    print('OK: Found "Cancel | Preview | Send" label')
else:
    print('ISSUE 2: Missing "Cancel | Preview | Send" label')

# 3. Check for toolbar
if 'toolbar' in content:
    print('OK: Toolbar found')
else:
    print('ISSUE 3: Toolbar not found')

# 4. Count toolbar buttons
buttons_to_check = ['btn_bold', 'btn_italic', 'btn_underline', 'btn_bullet', 'btn_numbered', 'btn_undo', 'btn_redo']
found_buttons = []
missing_buttons = []

for btn in buttons_to_check:
    if f'"{btn}"' in content or f"{btn} = " in content:
        found_buttons.append(btn.replace('btn_', '').upper())
    else:
        # Try a more flexible search
        if re.search(fr'\b{btn}\b', content):
            found_buttons.append(btn.replace('btn_', '').upper())
        else:
            missing_buttons.append(btn.replace('btn_', '').upper())

if missing_buttons:
    print(f'ISSUE 4: Missing toolbar buttons: {", ".join(missing_buttons)}')
else:
    print(f'OK: All toolbar buttons found: {", ".join(found_buttons)}')

# 5. Check for character counter
if 'char_label' in content:
    print('OK: Character counter found')
else:
    print('ISSUE 5: Character counter not found')

# 6. Check for status area
if '_status_message' in content and '_status_dot' in content:
    print('OK: Status area found')
else:
    print('ISSUE 6: Status area not found')

# 7. Check for preview window
if 'preview' in content.lower():
    print('OK: Preview window found')
else:
    print('ISSUE 7: Preview window not found')

# 8. Check for attachments panel
if 'attachments' in content.lower():
    print('OK: Attachments panel found')
else:
    print('ISSUE 8: Attachments panel not found')

# 9. Check for customer information
if 'customer information' in content.lower():
    print('OK: Customer information panel found')
else:
    print('ISSUE 9: Customer information panel not found')

print('=' * 60)
print('Summary:')
print('Issues that need fixing:')
if 'Cancel | Preview | Send' not in content:
    print('  - Missing \"Cancel | Preview | Send\" label')
if 'text="Send Email"' in content:
    print('  - Send button should say \"Send\" not \"Send Email\"')
if 'btn_bullet' not in content and 'btn_numbered' not in content:
    print('  - Missing bullets/numbering tools in toolbar')
if 'btn_color' not in content and 'btn_highlight' not in content:
    print('  - Missing text color/highlight tools in toolbar')
if 'btn_emoji' not in content:
    print('  - Missing emoji tool in toolbar')
if 'btn_clear' not in content:
    print('  - Missing clear formatting tool in toolbar')

print('\nDone!')