# ZEMmacOS Project Reorganization & Security Review

## Executive Summary

This document provides a comprehensive analysis of the ZEMmacOS project structure, a reorganization plan for improved maintainability, and a security review identifying local machine attack vectors.

---

## Part 1: Current Project Structure Analysis

### Root Directory (`D:\ZEMmacOS\`)

```
D:\ZEMmacOS\
├── __pycache__/
├── .vscode/
├── help/
├── logs/
├── public/
├── Scripts/
├── WSD_SDKToolkit_ZEMMACOS/        # SDK (ISOLATED - DO NOT MERGE)
├── .env.production                 # PRODUCTION SECRETS - RISK
├── .gitignore
├── build.bat
├── cleaner.py                      # Utility
├── config.json                     # App config with license key - RISK
├── gib_macos_wrapper.py            # App logic
├── gibMacOS.bat                    # Build script
├── gibMacOS.command                # Build script
├── gibMacOS.py                     # Main app logic (39KB)
├── idm_downloader.py               # App logic
├── installer.iss                   # Inno Setup script
├── live_log.py                     # Utility
├── logger.py                       # Utility
├── main.py                         # Entry point (61KB)
├── main_ui.py                      # UI framework (56KB)
├── modern_widgets.py               # UI components
├── query_db.mjs                    # Node.js script
├── safe_console.py                 # Utility
├── settings.py                     # App config
├── settings_ui.py                  # Settings UI (27KB)
├── themes.py                       # UI themes
├── update.py                       # App updater
└── ZEMmacOS.spec                   # PyInstaller spec
```

### Key Issues Identified

1. **17 Python files in root** - Violates separation of concerns
2. **Production secrets in `.env.production`** - Exposed credentials
3. **License key in `config.json`** - Plaintext credential storage
4. **SDK isolated but accessible** - Correctly separated at `WSD_SDKToolkit_ZEMMACOS/`
5. **Build artifacts mixed with source** - `build.bat`, `installer.iss`, `ZEMmacOS.spec` in root
6. **No clear module structure** - Imports rely on `sys.path.insert(0, BASE_DIR)`

---

## Part 2: Proposed Reorganization Plan

### Target Structure

```
D:\ZEMmacOS\
├── app/
│   ├── __init__.py
│   ├── main.py                 # Entry point (moved from root)
│   ├── main_ui.py              # UI framework (moved from root)
│   ├── settings_ui.py          # Settings UI (moved from root)
│   ├── themes.py               # UI themes (moved from root)
│   ├── modern_widgets.py       # UI components (moved from root)
│   ├── gib_macos_wrapper.py    # Core app logic (moved from root)
│   ├── gibMacOS.py             # Core app logic (moved from root)
│   ├── idm_downloader.py       # Core app logic (moved from root)
│   ├── cleaner.py              # Core app logic (moved from root)
│   ├── update.py               # App updater (moved from root)
│   ├── logger.py               # Utility (moved from root)
│   ├── safe_console.py         # Utility (moved from root)
│   ├── live_log.py             # Utility (moved from root)
│   ├── settings.py             # App config (moved from root)
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── constants.py        # Extracted from main.py
│   │   ├── helpers.py          # Network error detection, etc.
│   │   └── paths.py            # Path resolution utilities
│   ├── dialogs/
│   │   ├── __init__.py
│   │   ├── activation_dialog.py   # From SDK (activation.py)
│   │   ├── renewal_dialog.py      # From SDK (renewal.py)
│   │   ├── device_replace_dialog.py # From SDK (device_replace.py)
│   │   └── welcome_dialog.py      # From SDK (welcome.py)
│   └── services/
│       ├── __init__.py
│       ├── download_service.py    # Download orchestration
│       ├── license_service.py     # License management wrapper
│       ├── update_service.py      # Update checking
│       └── log_service.py         # Logging abstraction
│
├── sdk/
│   └── WSD_SDKToolkit_ZEMMACOS/  # KEEP ISOLATED - Never merge with app/
│       ├── __init__.py
│       ├── client.py
│       ├── license_engine.py
│       ├── hardware.py
│       ├── cache.py
│       ├── crypto.py
│       ├── activation.py
│       ├── renewal.py
│       ├── device_replace.py
│       ├── welcome.py
│       ├── config/
│       │   └── api-config.json   # SDK config (separate from app config)
│       ├── assets/
│       ├── docs/
│       ├── widgets/
│       │   ├── __init__.py
│       │   ├── dashboard_widget.py
│       │   ├── settings_widget.py
│       │   ├── status_widget.py
│       │   ├── activation_button.py
│       │   └── about.py          # NEW: From Part A
│       └── manifest.json
│
├── config/
│   ├── __init__.py
│   ├── app_config.json           # App settings (NO license key)
│   ├── license_config.json       # License key (encrypted, restricted perms)
│   └── .env                      # Runtime env vars (gitignored)
│
├── assets/
│   ├── images/
│   ├── icons/
│   └── themes/
│
├── logs/                         # Runtime logs (gitignored)
│
├── temp/                         # Temporary files (gitignored)
│
├── build/                        # Build artifacts (gitignored)
│   ├── dist/
│   ├── work/
│   └── *.spec
│
├── dist/                         # PyInstaller output (gitignored)
│
├── scripts/
│   ├── build.py                  # Unified build script
│   ├── build.bat                 # Windows build wrapper
│   └── gibMacOS.bat              # Legacy (deprecated)
│
├── installer/
│   └── installer.iss             # Inno Setup script
│
├── docs/
│   └── help/
│       └── index.html
│
├── .gitignore
├── .env.example                  # Template (no secrets)
├── pyproject.toml                # Modern Python packaging
├── README.md
└── requirements.txt
```

---

## Part 3: File Migration Mapping

### Root → app/
| Source | Destination | Category |
|--------|-------------|----------|
| `main.py` | `app/main.py` | Entry point |
| `main_ui.py` | `app/main_ui.py` | UI Framework |
| `settings_ui.py` | `app/settings_ui.py` | Settings UI |
| `themes.py` | `app/themes.py` | UI Themes |
| `modern_widgets.py` | `app/modern_widgets.py` | UI Components |
| `gib_macos_wrapper.py` | `app/gib_macos_wrapper.py` | Core Logic |
| `gibMacOS.py` | `app/gibMacOS.py` | Core Logic |
| `idm_downloader.py` | `app/idm_downloader.py` | Core Logic |
| `cleaner.py` | `app/cleaner.py` | Core Logic |
| `update.py` | `app/update.py` | Core Logic |
| `logger.py` | `app/logger.py` | Utility |
| `safe_console.py` | `app/safe_console.py` | Utility |
| `live_log.py` | `app/live_log.py` | Utility |
| `settings.py` | `app/settings.py` | Config |

### Root → app/utils/
| Source | Destination | Notes |
|--------|-------------|-------|
| (extracted from main.py) | `app/utils/constants.py` | `NETWORK_ERROR_KEYWORDS`, `_is_network_error_str` |
| (extracted from main.py) | `app/utils/helpers.py` | Common helpers |
| (new) | `app/utils/paths.py` | `BASE_DIR`, `get_config_dir()`, `get_sdk_path()` |

### Root → app/dialogs/
| Source | Destination | Notes |
|--------|-------------|-------|
| `WSD_SDKToolkit_ZEMMACOS/activation.py` | `app/dialogs/activation_dialog.py` | Thin wrapper around SDK |
| `WSD_SDKToolkit_ZEMMACOS/renewal.py` | `app/dialogs/renewal_dialog.py` | Thin wrapper around SDK |
| `WSD_SDKToolkit_ZEMMACOS/device_replace.py` | `app/dialogs/device_replace_dialog.py` | Thin wrapper around SDK |
| `WSD_SDKToolkit_ZEMMACOS/welcome.py` | `app/dialogs/welcome_dialog.py` | Thin wrapper around SDK |

### Root → app/services/
| Source | Destination | Notes |
|--------|-------------|-------|
| (new) | `app/services/license_service.py` | Wraps `LicenseEngine` |
| (new) | `app/services/download_service.py` | Orchestrates `gibMacOS.py`, `idm_downloader.py` |
| (new) | `app/services/update_service.py` | Wraps `update.py` |
| (new) | `app/services/log_service.py` | Wraps `logger.py`, `live_log.py` |

### Root → config/
| Source | Destination | Security Notes |
|--------|-------------|----------------|
| `config.json` | `config/app_config.json` | **Remove license_key** |
| `config.json` (license_key) | `config/license_config.json` | Encrypted, `chmod 600` |
| `.env.production` | `config/.env` | **Gitignored**, rotated |

### Root → build/install artifacts
| Source | Destination |
|--------|-------------|
| `build.bat` | `scripts/build.bat` |
| `gibMacOS.bat` | `scripts/gibMacOS.bat` (legacy) |
| `installer.iss` | `installer/installer.iss` |
| `ZEMmacOS.spec` | `build/ZEMmacOS.spec` |

---

## Part 4: Import Path Refactoring

### Current Import Pattern (Problematic)
```python
# main.py:20-23
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)
from WSD_SDKToolkit_ZEMMACOS import LicenseEngine, LicenseStatus
from WSD_SDKToolkit_ZEMMACOS import WelcomeDialog, ActivationDialog
```

### New Import Pattern (Clean)
```python
# app/main.py
from app.utils.paths import get_sdk_path, get_config_dir
from app.services.license_service import LicenseService
from app.dialogs.welcome_dialog import WelcomeDialog
from app.dialogs.activation_dialog import ActivationDialog

# SDK imports remain isolated
import sys
sys.path.insert(0, get_sdk_path())
from WSD_SDKToolkit_ZEMMACOS import LicenseEngine, LicenseStatus  # SDK only
```

### Path Utilities (`app/utils/paths.py`)
```python
"""Centralized path resolution - single source of truth"""
import os
from pathlib import Path

def get_base_dir() -> Path:
    """Get application base directory"""
    return Path(__file__).parent.parent

def get_app_dir() -> Path:
    return get_base_dir() / "app"

def get_sdk_path() -> Path:
    return get_base_dir() / "sdk" / "WSD_SDKToolkit_ZEMMACOS"

def get_config_dir() -> Path:
    return get_base_dir() / "config"

def get_assets_dir() -> Path:
    return get_base_dir() / "assets"

def get_logs_dir() -> Path:
    logs = get_base_dir() / "logs"
    logs.mkdir(exist_ok=True)
    return logs

def get_temp_dir() -> Path:
    temp = get_base_dir() / "temp"
    temp.mkdir(exist_ok=True)
    return temp

def get_build_dir() -> Path:
    build = get_base_dir() / "build"
    build.mkdir(exist_ok=True)
    return build

def get_dist_dir() -> Path:
    dist = get_base_dir() / "dist"
    dist.mkdir(exist_ok=True)
    return dist
```

---

## Part 5: Security Investigation & Threat Model

### Threat Matrix: Local Machine Attack Vectors

| #1: Cache Tampering |
| **Vector** | Cache files at `~/.websmith/<product>/cache.json` |
| **Impact** | Offline license validation bypass, trial extension |
| **Current State** | JSON file, no encryption, no integrity check |
| **Risk** | HIGH - User can edit `valid: true`, extend `cached_at` |
| **Mitigation** | AES-256-GCM encryption (config has it, verify implementation), HMAC signature, atomic writes with corruption detection (already in template) |

| Attack Vector #2: License File Tampering |
| **Vector** | License key in `config.json` (`"license_key": "MROC-..."`) |
| **Impact** | License key theft, reuse on other machines |
| **Current State** | Plaintext in user-writable config |
| **Risk** | HIGH - Trivial to copy |
| **Mitigation** | Move to `config/license_config.json` with restricted permissions (600), encrypt at rest using machine-bound key |

| Attack Vector #3: Trial Overriding Paid Licenses |
| **Vector** | Trial status cached locally, priority logic in `initialize()` |
| **Impact** | Expired trial could override valid license if server unreachable |
| **Current State** | `initialize()`: Priority 1 = paid license, Priority 2 = trial |
| **Risk** | MEDIUM - Race condition if server down |
| **Mitigation** | Explicit license validation before trial fallback, cache license separately from trial |

| Attack Vector #4: API Key Exposure |
| **Vector** | `api-config.json` contains `public_key` AND `secret` (HMAC secret) |
| **Impact** | Full API impersonation, license generation, customer data access |
| **Current State** | Secret in plaintext config file distributed with app |
| **Risk** | CRITICAL - HMAC secret allows signing arbitrary requests |
| **Mitigation** | **NEVER ship `secret` in client SDK**. Use asymmetric crypto or server-side signing only. Client gets `public_key` only. |

| Attack Vector #5: EXE Reverse Engineering |
| **Vector** | PyInstaller bundle - Python bytecode extractable via `pyinstxtractor` |
| **Impact** | Source code exposure, logic modification, secret extraction |
| **Current State** | Standard PyInstaller, no obfuscation |
| **Risk** | HIGH - Python bytecode is trivially decompiled |
| **Mitigation** | Cython compile critical modules (`license_engine`, `crypto`, `hardware`), PyArmor obfuscation, strip symbols |

| Attack Vector #6: Local JSON Editing |
| **Vector** | `config.json`, `api-config.json`, cache files all user-editable |
| **Impact** | Change API URL to malicious server, modify trial days, disable hardware binding |
| **Current State** | No integrity verification |
| **Risk** | HIGH |
| **Mitigation** | Config signature verification, embed critical config in binary, checksum validation on load |

| Attack Vector #7: Copied Licenses |
| **Vector** | License key + hardware ID copied to another machine |
| **Impact** | License sharing, device limit bypass |
| **Current State** | Hardware binding enabled but `offline_days: 0` |
| **Risk** | MEDIUM - Online validation catches it, offline doesn't |
| **Mitigation** | Server-side device tracking, require online activation, reduce `offline_days` |

| Attack Vector #8: Hardware Spoofing |
| **Vector** | `HardwareDetector` uses WMI, `/proc/cpuinfo`, `dmidecode`, MAC address |
| **Impact** | Clone hardware fingerprint to bypass binding |
| **Current State** | CPU → Motherboard → MAC fallback |
| **Risk** | MEDIUM - MAC spoofing trivial, WMI spoofing possible |
| **Mitigation** | TPM-based attestation (Windows), Secure Enclave (macOS), multiple factor binding |

| Attack Vector #9: Clock Manipulation |
| **Vector** | System time changed to extend trial/license |
| **Impact** | Trial never expires, license appears valid |
| **Current State** | Server timestamps used but local cache has `cached_at` |
| **Risk** | HIGH - Offline mode vulnerable |
| **Mitigation** | Monotonic clock (`time.monotonic()`), NTP verification, server-authoritative expiry |

| Attack Vector #10: Source Leakage |
| **Vector** | `.env.production` with real secrets, `config.json` with license key, PyInstaller extracts |
| **Impact** | Full backend access, customer data breach |
| **Current State** | Secrets in repo (`.env.production` tracked?) |
| **Risk** | CRITICAL |
| **Mitigation** | `.env.production` in `.gitignore`, use GitHub Secrets/Vercel Env for CI, rotate all exposed keys |

---

## Part 6: Packaging Review Checklist

Before any reorganization, verify these work with **current** structure:

| Check | Command | Expected |
|-------|---------|----------|
| PyInstaller builds | `pyinstaller ZEMmacOS.spec` | Single executable |
| Imports resolve | `python -c "import main; print('OK')"` | No ModuleNotFoundError |
| Tkinter starts | `python main.py` | Window opens, no crash |
| License init | `python -c "from WSD_SDKToolkit_ZEMMACOS import LicenseEngine; e=LicenseEngine(); print(e.initialize())"` | Returns LicenseStatus |
| Welcome screen | `python -c "from WSD_SDKToolkit_ZEMMACOS import WelcomeDialog; print('OK')"` | No import errors |
| SDK isolation | `python -c "import WSD_SDKToolkit_ZEMMACOS; print(WSD_SDKToolkit_ZEMMACOS.__file__)"` | Points to sdk/ folder |

---

## Part 7: Implementation Phases

### Phase 1: Safety First (No Code Movement)
1. ✅ Create `config/.env.example` template
2. ✅ Rotate ALL exposed secrets (JWT_SECRET, ADMIN_API_KEY, SIGNING_SECRET, API HMAC secret)
3. ✅ Remove `license_key` from `config.json`
4. ✅ Add `.env.production` to `.gitignore`
5. ✅ Verify build still works

### Phase 2: Path Utilities & Config
1. Create `app/utils/paths.py`
2. Update all files to use `get_sdk_path()`, `get_config_dir()`
3. Create `config/app_config.json` and `config/license_config.json`
4. Update `settings.py` to use new config locations
5. Test: `python main.py` works

### Phase 3: Module Restructure
1. Move files to `app/` per migration mapping
2. Create `app/__init__.py`, `app/utils/__init__.py`, etc.
3. Update imports in moved files
4. Test: `python app/main.py` works

### Phase 4: Service Layer
1. Create `app/services/license_service.py` wrapping `LicenseEngine`
2. Create `app/services/download_service.py`
3. Create `app/dialogs/` thin wrappers
4. Update `main.py` to use services
5. Test full activation flow

### Phase 5: Build System
1. Update `ZEMmacOS.spec` for new paths
2. Create `scripts/build.py` unified builder
3. Test PyInstaller build
4. Test installed EXE on clean machine

### Phase 6: Security Hardening
1. Implement config encryption for `license_config.json`
2. Add HMAC to cache files
3. Compile critical modules with Cython
4. Add PyArmor obfuscation to build pipeline
5. Penetration test local attack vectors

---

## Part 8: Critical "Do Not" Rules

| Rule | Rationale |
|------|-----------|
| **NEVER merge SDK into app/** | SDK is generated, versioned separately, used by other products |
| **NEVER ship HMAC secret in client** | Allows full API impersonation |
| **NEVER store license key in plaintext config** | Trivial extraction |
| **NEVER commit `.env.production`** | Production secrets in git history |
| **NEVER skip verification before reorganization** | Prevents "worked before, broken now" |

---

## Part 9: Verification Commands

```bash
# After each phase, run:
cd D:\ZEMmacOS

# 1. Import test
python -c "import app.main; print('Imports OK')"

# 2. SDK isolation test
python -c "import sys; sys.path.insert(0, 'sdk/WSD_SDKToolkit_ZEMMACOS'); from WSD_SDKToolkit_ZEMMACOS import LicenseEngine; print('SDK OK')"

# 3. License init test
python -c "
import sys
sys.path.insert(0, 'sdk/WSD_SDKToolkit_ZEMMACOS')
from WSD_SDKToolkit_ZEMMACOS import LicenseEngine
e = LicenseEngine()
s = e.initialize()
print(f'Status: {s.status}, Valid: {s.valid}')
"

# 4. Build test
python scripts/build.py

# 5. Run built EXE
dist/ZEMmacOS/ZEMmacOS.exe
```

---

## Conclusion

The ZEMmacOS project has **significant structural debt** (17 root Python files) and **critical security issues** (exposed HMAC secret, plaintext license key, secrets in repo). The reorganization plan separates concerns cleanly while maintaining SDK isolation. **Security fixes must precede any structural changes** - especially rotating the exposed HMAC secret which allows full API compromise.

**Priority Order:**
1. 🔴 **IMMEDIATE**: Rotate HMAC secret, remove secrets from repo
2. 🔴 **IMMEDIATE**: Encrypt license key storage
3. 🟡 **HIGH**: Reorganize into `app/`, `sdk/`, `config/`
4. 🟡 **HIGH**: Add config integrity verification
5. 🟢 **MEDIUM**: Cython/PyArmor hardening
6. 🟢 **MEDIUM**: TPM/Secure Enclave hardware binding