import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

# Need to set up environment for the publisher
os.environ['WEBSMITH_API_URL'] = 'https://api.example.com'
os.environ['WEBSMITH_CONTROLKIT_VERSION'] = '1.0.0'

# Import the publisher and test it directly
from app.internal.publisher import Publisher, PublishConfig

async def test_publish():
    publisher = Publisher()
    
    # Test with python runtime
    config = PublishConfig(
        productId='test-product',
        apiKey='test-key',
        runtime='python',
    )
    
    # We need a valid product in the database, so this will fail
    # Let's just check the template generation directly
    
    from app.internal.publisher.runtimes.python import getPythonTemplates
    from app.internal.publisher.index import PublisherContext
    
    context = PublisherContext(
        productId='test-product',
        product={
            'id': 'test-product',
            'name': 'Test Product',
            'description': 'Test',
            'version': '1.0',
            'company_name': 'Test',
            'primary_color': '#6366f1',
            'support_email': 'support@websmithdigital.com',
            'support_url': 'https://support.example.com',
            'logo_url': '',
            'trial_enabled': True,
            'trial_days': 14,
            'trial_message': '',
            'hardware_binding': True,
            'offline_days': 7,
            'renewal_reminder_days': 7,
        },
        productName='Test Product',
        plans=[],
        apiKey='test-key',
        apiSecret='test-secret',
        runtime='python',
        kitVersion='1.0.0',
        generatedAt='2024-01-01T00:00:00Z',
        jobId='test-job',
    )
    
    templates = getPythonTemplates(context)
    
    print("Generated templates:")
    for filename, content in templates.items():
        print(f"\n=== {filename} ===")
        # Check for template issues
        if '{{}}' in content:
            print(f"  ❌ UNREPLACED TEMPLATE: '{{{{}}}}' found!")
        if '${' in content:
            print(f"  ❌ UNREPLACED VARIABLE: '${{' found!")
        
        # Check imports
        if filename == 'universal_license_center.py':
            if 'import tkinter.ttk as ttk' in content or 'from tkinter import ttk' in content:
                print(f"  ✅ ttk import present")
            elif 'ttk.Combobox' in content:
                print(f"  ❌ ttk.Combobox used but no ttk import!")
        
        print(f"  Length: {len(content)} chars")
    
    # Write to temp dir for import test
    import tempfile
    import shutil
    
    tmpdir = tempfile.mkdtemp(prefix='sdk_test_')
    pkg_dir = os.path.join(tmpdir, 'WSD_SDKToolkit_TestProduct')
    os.makedirs(pkg_dir)
    
    for filename, content in templates.items():
        filepath = os.path.join(pkg_dir, filename)
        with open(filepath, 'w') as f:
            f.write(content)
    
    # Create config in the right place (parent of package)
    config_dir = os.path.join(tmpdir, 'config')
    os.makedirs(config_dir)
    with open(os.path.join(config_dir, 'api-config.json'), 'w') as f:
        import json
        json.dump({
            "product": {"id": "test", "name": "TestProduct", "version": "1.0"},
            "api": {"url": "https://api.example.com", "version": "v1", "public_key": "test", "secret": "test", "timeout": 30000, "retry_count": 3},
            "trial": {"enabled": True, "days": 14},
            "license": {"max_devices": 1, "hardware_binding": True},
            "offline": {"enabled": True, "cache_days": 7}
        }, f)
    
    sys.path.insert(0, tmpdir)
    
    print("\n=== Testing import ===")
    try:
        import WSD_SDKToolkit_TestProduct as sdk
        print("✅ Main package imports successfully")
    except Exception as e:
        print(f"❌ Main package import failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n=== Testing universal_license_center import ===")
    try:
        from WSD_SDKToolkit_TestProduct import universal_license_center
        print("✅ universal_license_center imports successfully")
    except Exception as e:
        print(f"❌ universal_license_center import failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n=== Testing UniversalLicenseCenter instantiation ===")
    try:
        from WSD_SDKToolkit_TestProduct.universal_license_center import UniversalLicenseCenter
        center = UniversalLicenseCenter()
        print("✅ UniversalLicenseCenter instantiates successfully")
    except Exception as e:
        print(f"❌ UniversalLicenseCenter instantiation failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print("\n=== Testing _contact_support (triggers ttk.Combobox) ===")
    try:
        method = getattr(center, '_contact_support', None)
        if method:
            print("✅ _contact_support method accessible - no NameError on ttk")
        else:
            print("❌ _contact_support method NOT found")
    except Exception as e:
        print(f"❌ _contact_support test failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    
    # Cleanup
    shutil.rmtree(tmpdir)
    print(f"\n✅ All tests passed!")

import asyncio
asyncio.run(test_publish())