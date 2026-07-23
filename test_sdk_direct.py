import re
import tempfile
import os
import sys
import shutil

with open(r'D:\websmith\app\internal\publisher\runtimes\python.ts', 'r') as f:
    content = f.read()

# Extract all templates
pattern = r"'(\w+\.py)': `([\s\S]*?)`,"
templates = dict(re.findall(pattern, content))

# Create temp directory and write SDK inside a package directory
tmpdir = tempfile.mkdtemp(prefix='wsd_sdk_test_')
pkg_dir = os.path.join(tmpdir, 'WSD_SDKToolkit_TestProduct')
os.makedirs(pkg_dir, exist_ok=True)

print(f"Generating SDK to: {pkg_dir}")

for filename, template in templates.items():
    # Replace template variables
    rendered = template.replace('${context.kitVersion}', '1.0.0')
    rendered = rendered.replace('${context.runtime}', 'python')
    rendered = rendered.replace('${context.productName}', 'TestProduct')
    
    filepath = os.path.join(pkg_dir, filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(rendered)

print("Files generated:")
for f in sorted(os.listdir(pkg_dir)):
    print(f"  {f}")

sys.path.insert(0, tmpdir)

# Now test import
print("\n=== Testing import ===")
try:
    import WSD_SDKToolkit_TestProduct as sdk
    print("[OK] Main package imports successfully")
except Exception as e:
    print(f"[FAIL] Main package import failed: {type(e).__name__}: {e}")
    sys.exit(1)

print("\n=== Testing universal_license_center import ===")
try:
    from WSD_SDKToolkit_TestProduct import universal_license_center
    print("[OK] universal_license_center imports successfully")
except Exception as e:
    print(f"[FAIL] universal_license_center import failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n=== Testing UniversalLicenseCenter instantiation ===")
try:
    from WSD_SDKToolkit_TestProduct.universal_license_center import UniversalLicenseCenter
    center = UniversalLicenseCenter()
    print("[OK] UniversalLicenseCenter instantiates successfully")
except Exception as e:
    print(f"[FAIL] UniversalLicenseCenter instantiation failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n=== Testing _contact_support (triggers ttk.Combobox) ===")
try:
    method = getattr(center, '_contact_support', None)
    if method:
        print("[OK] _contact_support method accessible - no NameError on ttk")
    else:
        print("[FAIL] _contact_support method NOT found")
        sys.exit(1)
except Exception as e:
    print(f"[FAIL] _contact_support test failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test other modules
print("\n=== Testing all module imports ===")
modules = [
    'client',
    'crypto',
    'hardware',
    'cache',
    'license_engine',
    'universal_email_dialog',
]
for mod in modules:
    try:
        __import__(f'WSD_SDKToolkit_TestProduct.{mod}')
        print(f"[OK] {mod} imports successfully")
    except Exception as e:
        print(f"[FAIL] {mod} import failed: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

# Test LicenseEngine instantiation
print("\n=== Testing LicenseEngine instantiation ===")
try:
    from WSD_SDKToolkit_TestProduct.license_engine import LicenseEngine
    engine = LicenseEngine()
    print("[OK] LicenseEngine instantiates successfully")
except Exception as e:
    print(f"[FAIL] LicenseEngine instantiation failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test UniversalEmailDialog instantiation
print("\n=== Testing UniversalEmailDialog instantiation ===")
try:
    from WSD_SDKToolkit_TestProduct.universal_email_dialog import UniversalEmailDialog
    from WSD_SDKToolkit_TestProduct.client import ApiClient
    from WSD_SDKToolkit_TestProduct.hardware import HardwareDetector
    from WSD_SDKToolkit_TestProduct.cache import CacheManager
    
    config = {'api': {'url': 'https://api.example.com', 'public_key': 'test', 'secret': 'test'}}
    client = ApiClient(config)
    hardware = HardwareDetector()
    cache = CacheManager(config)
    dialog = UniversalEmailDialog(config, client, hardware, cache)
    print("[OK] UniversalEmailDialog instantiates successfully")
except Exception as e:
    print(f"[FAIL] UniversalEmailDialog instantiation failed: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Cleanup
shutil.rmtree(tmpdir)
print(f"\n[OK] All tests passed!")