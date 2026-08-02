# Simple syntax check for universal_email_dialog.py
import re

with open('universal_email_dialog.py', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Basic checks
print('Checking for UI requirements...')

# 1. Check for Send button
if 'send_btn' not in content:
    print('ERROR: Send button reference not found')
    
if 'Cancel | Preview | Send' not in content:
    print('ERROR: Buttons label not found')
    
if 'text="Send"' not in content and 'text="Send Email"' not in content:
    print('ERROR: Send button text not found')
else:
    print('OK: Send button found')

# 2. Check for toolbar
if 'toolbar' not in content:
    print('ERROR: Toolbar not found')
else:
    print('OK: Toolbar found')

# 3. Check for essential toolbar buttons
toolbar_buttons = [
    ('bold', 'Bold'),
    ('italic', 'Italic'),
    ('underline', 'Underline'),
    ('bullet', 'Bullets'),
    ('numbered', 'Numbering'),
    ('undo', 'Undo'),
    ('redo', 'Redo')
]

for btn_id, btn_name in toolbar_buttons:
    if f'btn_{btn_id}' not in content:
        print('ERROR: ' + btn_name + ' button not found')
    else:
        print('OK: ' + btn_name + ' button found')

# 4. Check for character counter
if 'char_label' not in content:
    print('ERROR: Character counter not found')
else:
    print('OK: Character counter found')

# 5. Check for status area
if 'status_message' not in content or 'status_area' not in content:
    print('ERROR: Status area not found')
else:
    print('OK: Status area found')

# 6. Check for preview window
if 'preview' not in content.lower():
    print('ERROR: Preview window not found')
else:
    print('OK: Preview window found')

# 7. Check for attachments panel
if 'attachments' not in content.lower():
    print('ERROR: Attachments panel not found')
else:
    print('OK: Attachments panel found')

# 8. Check for customer information
if 'customer information' not in content.lower():
    print('ERROR: Customer information panel not found')
else:
    print('OK: Customer information panel found')

print('\nSyntax check completed')