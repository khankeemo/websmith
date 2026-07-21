import { PublisherContext } from '../index';

export function getPythonTemplates(context: PublisherContext): Record<string, string> {
  return {
    '__init__.py': `"""${context.productName} SDK - License Management Client"""
__version__ = "${context.kitVersion}"
__all__ = [
    "ApiClient", "ApiError",
    "LicenseEngine", "LicenseStatus",
    "HardwareDetector",
    "CacheManager",
    "WelcomeDialog",
    "ActivationDialog",
    "RenewalDialog",
    "RenewLicenseDialog",
    "DeviceReplaceDialog",
    "AboutWidget",
    "AboutDialog",
]

from .client import ApiClient, ApiError
from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .cache import CacheManager
from .welcome import WelcomeDialog
from .activation import ActivationDialog
from .renewal import RenewalDialog
from .renew_license_dialog import RenewLicenseDialog
from .device_replace import DeviceReplaceDialog
from .widgets.about import AboutWidget, AboutDialog
`,
    'client.py': `"""API Client for ${context.productName} License API"""
import json
import time
from typing import Any, Dict, Optional

import requests

from .crypto import generate_timestamp, generate_nonce, sign_request
from .hardware import HardwareDetector
from .cache import CacheManager

SDK_VERSION = "${context.kitVersion}"
RUNTIME_TYPE = "${context.runtime}"
RETRYABLE_STATUSES = {500, 502, 503, 504}


class ApiError(Exception):
    def __init__(self, status_code: int, message: str, data: Optional[Dict[str, Any]] = None):
        self.status_code = status_code
        self.message = message
        self.data = data or {}
        super().__init__(f"API Error {status_code}: {message}")


class ApiClient:
    def __init__(
        self,
        config: Dict[str, Any],
        hardware: Optional[HardwareDetector] = None,
        cache: Optional[CacheManager] = None
    ):
        self.config = config
        self.api_config = config.get('api', {})
        self.base_url = self.api_config.get('url', '').rstrip('/')
        self.api_version = self.api_config.get('version', 'v1')
        self.api_key = self.api_config.get('public_key', '')
        self.api_secret = self.api_config.get('secret', '')
        self.timeout = float(self.api_config.get('timeout', 30000)) / 1000
        self.retry_count = self.api_config.get('retry_count', 3)
        self.product_id = config.get('product', {}).get('id', '')
        self._hardware = hardware or HardwareDetector()
        self._cache = cache

    def _get_hardware_id(self) -> str:
        return self._hardware.get_fingerprint()

    def _sign_request(self, payload: Dict[str, Any],
                       method: str = 'POST',
                       path: str = '',
                       query: str = '') -> Dict[str, str]:
        timestamp = generate_timestamp()
        nonce = generate_nonce()
        signature = sign_request(payload, self.api_key, timestamp, nonce,
                                  method=method, path=path, query=query)
        return {
            'x-api-key': self.api_key,
            'x-timestamp': timestamp,
            'x-nonce': nonce,
            'x-signature': signature
        }

    def _request(
        self,
        endpoint: str,
        payload: Dict[str, Any],
        retries: Optional[int] = None
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/api/{self.api_version}/{endpoint}"
        max_retries = retries if retries is not None else self.retry_count
        request_payload = payload.copy()
        if self.product_id:
            request_payload.setdefault('product_id', self.product_id)
        for attempt in range(max_retries + 1):
            api_path = f"/api/{self.api_version}/{endpoint}"
            headers = self._sign_request(request_payload, method='POST',
                                          path=api_path, query='')
            headers['Content-Type'] = 'application/json'
            try:
                response = requests.post(
                    url, json=request_payload,
                    headers=headers, timeout=self.timeout
                )
                data = {}
                try:
                    data = response.json()
                except Exception:
                    if response.text:
                        data = {'message': response.text}
                if 200 <= response.status_code < 300:
                    return data
                if response.status_code == 429:
                    if attempt < max_retries:
                        retry_after = int(response.headers.get('Retry-After', 5))
                        time.sleep(retry_after)
                        continue
                    raise ApiError(response.status_code, 'Rate limit exceeded', data)
                if response.status_code in RETRYABLE_STATUSES:
                    if attempt < max_retries:
                        time.sleep((attempt + 1) * 2)
                        continue
                    raise ApiError(response.status_code, 'Server error', data)
                message = data.get('message', data.get('error', f'HTTP {response.status_code}'))
                raise ApiError(response.status_code, message, data)
            except requests.exceptions.Timeout:
                if attempt < max_retries:
                    time.sleep((attempt + 1) * 2)
                    continue
                raise ApiError(504, f'Request timeout after {self.timeout}s')
            except requests.exceptions.ConnectionError as e:
                if attempt < max_retries:
                    time.sleep((attempt + 1) * 2)
                    continue
                raise ApiError(503, f'Connection error: {str(e)}')
            except ApiError:
                raise
            except Exception as e:
                if attempt < max_retries:
                    time.sleep((attempt + 1) * 2)
                    continue
                raise ApiError(500, f'Request failed: {str(e)}')
        raise ApiError(500, f'Failed after {max_retries} retries')

    def validate_license(self, license_key: str, hardware_id: Optional[str] = None) -> Dict[str, Any]:
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        payload = {'action': 'validate', 'license_key': license_key, 'hardware_id': hardware_id}
        if self._cache and self._cache.is_valid():
            cached = self._cache.get_license_status()
            if cached:
                return cached
        response = self._request('license', payload)
        if self._cache and response.get('success') and response.get('data', {}).get('valid', False):
            self._cache.set_license_status(response)
        return response

    def activate_license(self, license_key: str, hardware_id: Optional[str] = None) -> Dict[str, Any]:
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        payload = {'action': 'activate', 'license_key': license_key, 'hardware_id': hardware_id}
        response = self._request('license', payload)
        if self._cache:
            self._cache.invalidate_license_status()
        return response

    def deactivate_license(self, license_key: str, hardware_id: Optional[str] = None) -> Dict[str, Any]:
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        payload = {'license_key': license_key, 'hardware_id': hardware_id}
        response = self._request('license/deactivate', payload)
        if self._cache:
            self._cache.invalidate_license_status()
        return response

    def renew_license(self, license_key: str, extra_days: Optional[int] = None) -> Dict[str, Any]:
        payload = {'action': 'renew', 'license_key': license_key}
        if extra_days is not None:
            payload['extra_days'] = extra_days
        response = self._request('license', payload)
        if self._cache:
            self._cache.invalidate_license_status()
        return response

    def start_trial(self, email: str, customer_name: str = '',
                    customer_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        hardware_id = self._get_hardware_id()
        payload: Dict[str, Any] = {
            'action': 'start', 'customer_email': email,
            'customer_name': customer_name, 'hardware_id': hardware_id
        }
        if customer_data:
            payload['customer_data'] = customer_data
        return self._request('trial', payload)

    def get_trial_status(self, hardware_id: Optional[str] = None) -> Dict[str, Any]:
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        return self._request('trial', {'action': 'status', 'hardware_id': hardware_id})

    def convert_trial(self, hardware_id: Optional[str] = None, plan: Optional[str] = None, customer_name: str = '', customer_email: str = '') -> Dict[str, Any]:
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        payload: Dict[str, Any] = {
            'action': 'convert',
            'hardware_id': hardware_id,
            'plan': plan or '',
            'customer_name': customer_name or 'SDK User',
            'customer_email': customer_email or '',
        }
        response = self._request('trial', payload)
        if self._cache:
            self._cache.invalidate_license_status()
        return response

    def bind_device(self, license_key: str, hardware_id: Optional[str] = None, device_name: Optional[str] = None) -> Dict[str, Any]:
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        payload: Dict[str, Any] = {'action': 'bind', 'license_key': license_key, 'hardware_id': hardware_id}
        if device_name:
            payload['device_name'] = device_name
        return self._request('device', payload)

    def replace_device(self, license_key: str, new_hardware_id: Optional[str] = None, old_hardware_id: Optional[str] = None, device_name: Optional[str] = None) -> Dict[str, Any]:
        if new_hardware_id is None:
            new_hardware_id = self._get_hardware_id()
        if old_hardware_id is None:
            raise ValueError("old_hardware_id is required for device replacement")
        payload = {
            'action': 'replace', 'license_key': license_key,
            'old_hardware_id': old_hardware_id, 'new_hardware_id': new_hardware_id
        }
        if device_name:
            payload['device_name'] = device_name
        response = self._request('device', payload)
        if self._cache:
            self._cache.invalidate_license_status()
        return response

    def verify_license_for_renewal(self, license_key: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {'license_key': license_key}
        return self._request('license/verify-renewal', payload)

    def get_license_details(self, license_key: str) -> Dict[str, Any]:
        import requests as _requests
        url = f"{self.base_url}/api/{self.api_version}/license/details/{license_key}"
        api_path = f"/api/{self.api_version}/license/details/{license_key}"
        headers = self._sign_request({}, method='GET', path=api_path)
        headers['Content-Type'] = 'application/json'
        try:
            resp = _requests.get(url, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return {'success': False, 'error': resp.json().get('message', f'HTTP {resp.status_code}')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_available_plans(self, license_key: str) -> Dict[str, Any]:
        import requests as _requests
        payload: Dict[str, Any] = {'license_key': license_key}
        api_path = f"/api/{self.api_version}/license/verify-renewal"
        headers = self._sign_request(payload, method='POST', path=api_path, query='')
        headers['Content-Type'] = 'application/json'
        url = f"{self.base_url}{api_path}"
        try:
            resp = _requests.post(url, json=payload, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                data = resp.json()
                plans = data.get('available_plans', [])
                return {
                    'success': True,
                    'product': {'id': data.get('product_id', ''), 'name': data.get('product_name', '')},
                    'current_plan': {'id': data.get('plan_id', ''), 'name': data.get('plan', '')},
                    'plans': plans,
                }
            return {'success': False, 'plans': []}
        except Exception:
            return {'success': False, 'plans': []}

    def send_renewal_request(self, license_key: str, customer_name: str = '',
                             email: str = '', mobile: str = '',
                             subject: str = '', message: str = '',
                             request_type: str = 'renew',
                             selected_plan_id: str = '',
                             selected_plan_name: str = '') -> Dict[str, Any]:
        import requests as _requests
        payload: Dict[str, Any] = {
            'license_key': license_key,
            'customer_name': customer_name,
            'email': email,
            'mobile': mobile,
            'subject': subject,
            'message': message,
            'request_type': request_type,
        }
        if selected_plan_id:
            payload['selected_plan_id'] = selected_plan_id
        if selected_plan_name:
            payload['selected_plan_name'] = selected_plan_name
        url = f"{self.base_url}/internal/backend/licenses/renewal-request"
        try:
            resp = _requests.post(url, json=payload, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            data = resp.json() if resp.text else {}
            return {'success': False, 'error': data.get('error', f'HTTP {resp.status_code}')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_products(self) -> Dict[str, Any]:
        import requests as _requests
        url = f"{self.base_url}/api/{self.api_version}/store/products"
        try:
            resp = _requests.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return {'success': False, 'products': []}
        except Exception:
            return {'success': False, 'products': []}

    def update_customer(self, name: str, email: str, phone: str,
                         hardware_id: Optional[str] = None) -> Dict[str, Any]:
        import requests as _requests
        if hardware_id is None:
            hardware_id = self._get_hardware_id()
        url = f"{self.base_url}/api/{self.api_version}/customer/register"
        payload = {
            'name': name,
            'email': email,
            'mobile': phone,
            'hardware_id': hardware_id,
        }
        try:
            resp = _requests.post(
                url, json=payload,
                headers={'X-API-Key': self.api_key,
                         'Content-Type': 'application/json'},
                timeout=self.timeout
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success') and self._cache:
                    self._cache.invalidate_license_status()
                return data
            return {'success': False,
                    'error': resp.json().get('error', f'HTTP {resp.status_code}')}
        except Exception as e:
            return {'success': False, 'error': str(e)}
`,
    'crypto.py': `"""Cryptographic utilities for API request signing"""
import base64
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict


def generate_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def generate_nonce() -> str:
    return str(uuid.uuid4())


def sign_request(
    payload: Dict[str, Any],
    secret: str,
    timestamp: str,
    nonce: str,
    method: str = 'POST',
    path: str = '',
    query: str = ''
) -> str:
    payload_json = json.dumps(payload, separators=(',', ':'))
    body_hash = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
    message = f"{method}\\n{path}\\n{query}\\n{body_hash}\\n{timestamp}\\n{nonce}"
    signature = hmac.new(
        secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).digest()
    return base64.b64encode(signature).decode('utf-8')
`,
    'hardware.py': `"""Hardware fingerprint generation"""
import hashlib
import platform
import re
import subprocess
import uuid
from typing import Dict, Optional


class HardwareDetector:
    def __init__(self):
        self._fingerprint: Optional[str] = None
        self._identifiers: Optional[Dict[str, str]] = None

    def get_fingerprint(self) -> str:
        if self._fingerprint is None:
            identifiers = self._collect_identifiers()
            combined = self._build_combined_string(identifiers)
            self._fingerprint = self._hash_identifiers(combined)
            self._identifiers = identifiers
        return self._fingerprint

    def get_identifiers(self) -> Dict[str, str]:
        if self._identifiers is None:
            self.get_fingerprint()
        return self._identifiers or {}

    def _collect_identifiers(self) -> Dict[str, str]:
        identifiers: Dict[str, str] = {}
        cpu_id = self._get_cpu_id()
        if cpu_id:
            identifiers['cpu_id'] = cpu_id
        motherboard_id = self._get_motherboard_id()
        if motherboard_id:
            identifiers['motherboard_id'] = motherboard_id
        if not motherboard_id:
            network_id = self._get_network_id()
            if network_id:
                identifiers['network_id'] = network_id
        os_info = self._get_os_info()
        if os_info:
            identifiers['os_info'] = os_info
        return identifiers

    def _get_cpu_id(self) -> Optional[str]:
        system = platform.system()
        try:
            if system == 'Windows':
                return self._get_cpu_id_windows()
            elif system == 'Darwin':
                return self._get_cpu_id_darwin()
            elif system == 'Linux':
                return self._get_cpu_id_linux()
        except Exception:
            pass
        return platform.processor() or None

    def _get_cpu_id_windows(self) -> Optional[str]:
        try:
            result = subprocess.run(
                ['wmic', 'cpu', 'get', 'ProcessorId', '/value'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                match = re.search(r'ProcessorId=(.+)', result.stdout)
                if match:
                    cpu_id = match.group(1).strip()
                    if cpu_id:
                        return cpu_id
        except Exception:
            pass
        return platform.processor() or None

    def _get_cpu_id_darwin(self) -> Optional[str]:
        try:
            result = subprocess.run(
                ['sysctl', '-n', 'hw.model'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                model = result.stdout.strip()
                if model:
                    return f"mac-{model}"
        except Exception:
            pass
        try:
            result = subprocess.run(
                ['sysctl', '-n', 'machdep.cpu.brand_string'],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0:
                brand = result.stdout.strip()
                if brand:
                    return hashlib.sha256(brand.encode('utf-8')).hexdigest()[:16]
        except Exception:
            pass
        return platform.processor() or None

    def _get_cpu_id_linux(self) -> Optional[str]:
        try:
            with open('/proc/cpuinfo', 'r') as f:
                content = f.read()
            serial_match = re.search(r'Serial\s*:\s*([0-9a-f]+)', content, re.IGNORECASE)
            if serial_match:
                return f"cpu-{serial_match.group(1)}"
            vendor = ''
            family = ''
            for line in content.splitlines():
                if line.startswith('vendor_id'):
                    vendor = line.split(':')[1].strip()
                elif line.startswith('cpu family'):
                    family = line.split(':')[1].strip()
            if vendor and family:
                return f"{vendor}-{family}"
        except Exception:
            pass
        return platform.processor() or None

    def _get_motherboard_id(self) -> Optional[str]:
        system = platform.system()
        try:
            if system == 'Windows':
                result = subprocess.run(
                    ['wmic', 'baseboard', 'get', 'SerialNumber', '/value'],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    match = re.search(r'SerialNumber=(.+)', result.stdout)
                    if match:
                        serial = match.group(1).strip()
                        if serial and serial not in ('To be filled by O.E.M.', 'Default string'):
                            return f"mb-{serial}"
            elif system == 'Linux':
                result = subprocess.run(
                    ['dmidecode', '-s', 'baseboard-serial-number'],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    serial = result.stdout.strip()
                    if serial and serial not in ('To be filled by O.E.M.', 'Default string'):
                        return f"mb-{serial}"
        except Exception:
            pass
        return None

    def _get_network_id(self) -> Optional[str]:
        try:
            mac = uuid.getnode()
            if mac and (mac >> 40) % 2 == 0:
                return hashlib.sha256(f"net-{mac:x}".encode('utf-8')).hexdigest()[:16]
        except Exception:
            pass
        return None

    def _get_os_info(self) -> Optional[str]:
        return f"{platform.system()}-{platform.release()}"

    def _build_combined_string(self, identifiers: Dict[str, str]) -> str:
        parts = []
        for key in ('cpu_id', 'motherboard_id', 'network_id'):
            if key in identifiers:
                parts.append(identifiers[key])
        return '|'.join(parts)

    def _hash_identifiers(self, data: str) -> str:
        return hashlib.sha256(data.encode('utf-8')).hexdigest()
`,
    'cache.py': `"""Local cache manager for license status (offline support)"""
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional


class CacheManager:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.product_id = config.get('product', {}).get('id', 'unknown')
        safe_name = ''.join(c if c.isalnum() or c in '-_' else '_' for c in self.product_id)
        self._cache_dir = Path.home() / '.websmith' / safe_name
        self._cache_file = self._cache_dir / 'cache.json'
        self._tmp_file = self._cache_dir / 'cache.tmp'
        self._corrupt_file = self._cache_dir / 'cache.corrupt'
        self._ttl_days = self._get_ttl()
        self._cache: Optional[Dict[str, Any]] = None

    def _get_ttl(self) -> int:
        offline = self.config.get('offline', {})
        return offline.get('cache_days', 0)

    def _ensure_cache_dir(self) -> None:
        self._cache_dir.mkdir(parents=True, exist_ok=True)

    def _load_cache(self) -> Dict[str, Any]:
        if self._cache is not None:
            return self._cache
        self._ensure_cache_dir()
        if not self._cache_file.exists():
            self._cache = {}
            return self._cache
        try:
            with open(self._cache_file, 'r') as f:
                self._cache = json.load(f)
            return self._cache
        except (json.JSONDecodeError, IOError):
            self._preserve_corrupt_cache()
            self._cache = {}
            return self._cache

    def _preserve_corrupt_cache(self) -> None:
        if self._cache_file.exists():
            try:
                if self._corrupt_file.exists():
                    self._corrupt_file.unlink()
                self._cache_file.rename(self._corrupt_file)
            except Exception:
                self._cache_file.unlink()

    def _save_cache(self) -> None:
        if self._cache is None:
            return
        self._ensure_cache_dir()
        try:
            with open(self._tmp_file, 'w') as f:
                json.dump(self._cache, f, indent=2)
            os.replace(self._tmp_file, self._cache_file)
        except Exception:
            if self._tmp_file.exists():
                try:
                    self._tmp_file.unlink()
                except Exception:
                    pass

    def get(self, key: str) -> Optional[Any]:
        cache = self._load_cache()
        entry = cache.get(key)
        if entry is None:
            return None
        if self.is_expired(entry):
            self.delete(key)
            return None
        return entry.get('value')

    def set(self, key: str, value: Any) -> None:
        cache = self._load_cache()
        cache[key] = {'value': value, 'cached_at': time.time()}
        self._save_cache()

    def delete(self, key: str) -> None:
        cache = self._load_cache()
        if key in cache:
            del cache[key]
            self._save_cache()

    def clear(self) -> None:
        self._cache = {}
        self._save_cache()

    def is_expired(self, entry: Dict[str, Any]) -> bool:
        cached_at = entry.get('cached_at', 0)
        ttl_seconds = self._ttl_days * 24 * 60 * 60
        return (time.time() - cached_at) > ttl_seconds

    def is_valid(self) -> bool:
        cache = self._load_cache()
        entry = cache.get('license_status')
        if entry is None:
            return False
        return not self.is_expired(entry)

    def exists(self) -> bool:
        return self._cache_file.exists()

    def get_license_status(self) -> Optional[Dict[str, Any]]:
        return self.get('license_status')

    def set_license_status(self, status: Dict[str, Any]) -> None:
        self.set('license_status', status)

    def invalidate_license_status(self) -> None:
        self.delete('license_status')

    def set_onboarding_complete(self) -> None:
        cache = self._load_cache()
        cache['onboarding_complete'] = {'value': True, 'cached_at': time.time()}
        self._save_cache()

    def is_onboarding_complete(self) -> bool:
        return self.get('onboarding_complete') is True

    def save_license_key(self, license_key: str) -> None:
        key_path = self._cache_dir / 'license.key'
        try:
            key_path.write_text(license_key.strip())
        except Exception:
            pass

    def load_license_key(self) -> Optional[str]:
        key_path = self._cache_dir / 'license.key'
        if key_path.exists():
            try:
                return key_path.read_text().strip() or None
            except Exception:
                pass
        return None

    def clear_license_key(self) -> None:
        key_path = self._cache_dir / 'license.key'
        if key_path.exists():
            try:
                key_path.unlink()
            except Exception:
                pass
`,
    'license_engine.py': `"""License validation and management engine"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from .client import ApiClient, ApiError
from .hardware import HardwareDetector
from .cache import CacheManager

logger = logging.getLogger(__name__)


class LicenseStatus:
    def __init__(self, valid: bool, status: str, **kwargs):
        self.valid = valid
        self.status = status
        self.expiry_date = kwargs.get('expiry_date')
        self.days_left = kwargs.get('days_left', 0)
        self.plan = kwargs.get('plan')
        self.hardware_id = kwargs.get('hardware_id')
        self.message = kwargs.get('message')
        self.license_key = kwargs.get('license_key')
        self.trial_active = kwargs.get('trial_active', status == 'trial')
        self.customer_name = kwargs.get('customer_name')
        self.customer_email = kwargs.get('customer_email')
        self.customer_phone = kwargs.get('customer_phone')
        self.customer_mobile = kwargs.get('customer_mobile')

    def to_dict(self) -> Dict[str, Any]:
        return {
            'valid': self.valid,
            'status': self.status,
            'expiry_date': self.expiry_date,
            'days_left': self.days_left,
            'plan': self.plan,
            'hardware_id': self.hardware_id,
            'message': self.message,
            'license_key': self.license_key,
            'trial_active': self.trial_active,
            'customer_name': self.customer_name,
            'customer_email': self.customer_email,
            'customer_phone': self.customer_phone,
            'customer_mobile': self.customer_mobile
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'LicenseStatus':
        return cls(
            valid=data.get('valid', False),
            status=data.get('status', 'unlicensed'),
            expiry_date=data.get('expiry_date'),
            days_left=data.get('days_left', 0),
            plan=data.get('plan'),
            hardware_id=data.get('hardware_id'),
            message=data.get('message'),
            license_key=data.get('license_key'),
            trial_active=data.get('trial_active', data.get('status') == 'trial'),
            customer_name=data.get('customer_name'),
            customer_email=data.get('customer_email'),
            customer_phone=data.get('customer_phone'),
            customer_mobile=data.get('customer_mobile')
        )


class LicenseEngine:
    def __init__(self, config_path: Optional[str] = None):
        self.config = self._load_config(config_path)
        self._hardware = HardwareDetector()
        self._cache = CacheManager(self.config)
        self._client = ApiClient(
            config=self.config,
            hardware=self._hardware,
            cache=self._cache
        )
        self._status: Optional[LicenseStatus] = None
        self._license_key: Optional[str] = None
        if not self._license_key:
            self._license_key = self._cache.load_license_key()

    def _load_config(self, config_path: Optional[str]) -> Dict[str, Any]:
        if config_path is None:
            base_dir = Path(__file__).parent.parent
            config_path = str(base_dir / 'config' / 'api-config.json')
            if not Path(config_path).exists():
                config_path = str(Path.cwd() / 'config' / 'api-config.json')
        if not Path(config_path).exists():
            raise FileNotFoundError(
                f"api-config.json not found at: {config_path}"
            )
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def initialize(self) -> LicenseStatus:
        if self._cache.is_valid():
            cached = self._cache.get_license_status()
            if cached:
                self._status = LicenseStatus.from_dict(cached)
                if not self._license_key and self._status.license_key:
                    self._license_key = self._status.license_key
                return self._status
        try:
            hardware_id = self._hardware.get_fingerprint()
            # Priority 1: Validate active paid license from server
            if self._license_key:
                try:
                    result = self._client.validate_license(self._license_key, hardware_id)
                    data = result.get('data', result)
                    if data.get('valid'):
                        self._status = LicenseStatus(
                            valid=True,
                            status=data.get('status', 'active'),
                            expiry_date=data.get('expiry_date'),
                            days_left=data.get('days_left', 0),
                            plan=data.get('plan'),
                            hardware_id=hardware_id,
                            license_key=self._license_key,
                            customer_name=data.get('customer_name'),
                            customer_email=data.get('customer_email'),
                            customer_phone=data.get('customer_phone'),
                            customer_mobile=data.get('customer_mobile'),
                            message='License active'
                        )
                        if self._status.valid:
                            self._cache.set_license_status(self._status.to_dict())
                        return self._status
                except Exception:
                    pass  # Server error — fall through to trial
            # Priority 2: Check for active trial
            trial_response = self._client.get_trial_status(hardware_id)
            trial_data = trial_response.get('data', {})
            if trial_data.get('has_trial'):
                status_str = trial_data.get('status', 'trial')
                self._status = LicenseStatus(
                    valid=status_str == 'active',
                    status=status_str,
                    expiry_date=trial_data.get('expiry_date'),
                    days_left=trial_data.get('days_left', 0),
                    plan=trial_data.get('plan'),
                    hardware_id=hardware_id,
                    message=f"Trial is {status_str}",
                    customer_name=trial_data.get('customer_name'),
                    customer_email=trial_data.get('customer_email'),
                    customer_phone=trial_data.get('customer_phone'),
                    customer_mobile=trial_data.get('customer_mobile')
                )
                if self._status.valid:
                    self._cache.set_license_status(self._status.to_dict())
                return self._status
            # No license or trial found
            self._status = LicenseStatus(
                valid=False, status='unlicensed',
                hardware_id=hardware_id,
                message='No license or trial found'
            )
            return self._status
        except Exception as e:
            logger.exception("Unexpected error during license initialization")
            cached = self._cache.get_license_status()
            if cached:
                return LicenseStatus.from_dict(cached)
            self._status = LicenseStatus(
                valid=False, status='error',
                message=f"Unexpected error: {str(e)}"
            )
            return self._status

    def get_hardware_id(self) -> str:
        return self._hardware.get_fingerprint()

    def get_status(self) -> Optional[LicenseStatus]:
        return self._status

    def get_license_key(self) -> Optional[str]:
        return self._license_key

    def has_license_key(self) -> bool:
        return self._license_key is not None

    def validate(self, license_key: Optional[str] = None) -> Dict[str, Any]:
        key = license_key or self._license_key
        if not key:
            raise ValueError("License key unavailable. Please activate first.")
        hardware_id = self._hardware.get_fingerprint()
        result = self._client.validate_license(key, hardware_id)
        data = result.get('data', result)
        if data.get('valid'):
            if data.get('license_key'):
                self._license_key = data['license_key']
            # Create LicenseStatus from validation response which has all customer fields
            self._status = LicenseStatus(
                valid=data.get('valid', True),
                status=data.get('status', 'active'),
                expiry_date=data.get('expiry_date'),
                days_left=data.get('days_left', 0),
                plan=data.get('plan'),
                hardware_id=hardware_id,
                license_key=data.get('license_key'),
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile')
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def activate(self, license_key: str) -> Dict[str, Any]:
        result = self._client.activate_license(license_key)
        if result.get('success'):
            self._license_key = license_key
            self._cache.save_license_key(license_key)
            data = result.get('data', result)
            self._status = LicenseStatus(
                valid=True,
                status=data.get('status', 'active'),
                expiry_date=data.get('expiry_date'),
                days_left=data.get('days_left', 0),
                plan=data.get('plan'),
                hardware_id=self._hardware.get_fingerprint(),
                license_key=license_key,
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile')
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def start_trial(self, email: str, customer_name: str = '',
                    customer_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        result = self._client.start_trial(email, customer_name=customer_name, customer_data=customer_data)
        if result.get('success'):
            data = result.get('data', result)
            self._status = LicenseStatus(
                valid=True,
                status='trial',
                expiry_date=data.get('expiry_date'),
                days_left=data.get('days_left', data.get('duration_days', 0)),
                plan=data.get('plan', 'Trial'),
                hardware_id=self._hardware.get_fingerprint(),
                customer_name=data.get('customer_name') or customer_name,
                customer_email=data.get('customer_email') or email,
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile')
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def convert_trial(self, plan: Optional[str] = None, customer_name: str = '', customer_email: str = '') -> Dict[str, Any]:
        status = self.initialize()
        if not status or status.status != 'trial':
            raise RuntimeError("No active trial to convert.")
        hardware_id = self._hardware.get_fingerprint()
        result = self._client.convert_trial(hardware_id, plan, customer_name, customer_email)
        if result.get('success'):
            data = result.get('data', result)
            if 'license_key' in data:
                self._license_key = data.get('license_key')
            self._status = LicenseStatus(
                valid=True,
                status=data.get('status', 'active'),
                expiry_date=data.get('expiry_date'),
                days_left=data.get('days_left', 0),
                plan=data.get('plan'),
                hardware_id=hardware_id,
                license_key=data.get('license_key'),
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile')
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def get_plans(self) -> Dict[str, Any]:
        return self._client.get_products()

    def renew(self, extra_days: Optional[int] = None) -> Dict[str, Any]:
        if not self._license_key:
            raise ValueError("License key unavailable. Please activate first.")
        result = self._client.renew_license(self._license_key, extra_days)
        if result.get('success'):
            data = result.get('data', result)
            hardware_id = self._hardware.get_fingerprint()
            self._status = LicenseStatus(
                valid=True,
                status=data.get('status', 'active'),
                expiry_date=data.get('new_expiry_date') or data.get('expiry_date'),
                days_left=data.get('days_left', 0),
                plan=data.get('plan'),
                hardware_id=hardware_id,
                license_key=self._license_key,
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile')
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def deactivate(self, license_key: Optional[str] = None) -> Dict[str, Any]:
        key = license_key or self._license_key
        if not key:
            raise ValueError("License key unavailable. Please provide a key.")
        result = self._client.deactivate_license(key)
        if result.get('success'):
            self._cache.invalidate_license_status()
            self._status = None
            if license_key is None:
                self._license_key = None
                self._cache.clear_license_key()
        return result

    def replace_hardware(self, device_name: Optional[str] = None) -> Dict[str, Any]:
        if not self._license_key:
            raise ValueError("License key unavailable. Please activate first.")
        new_hardware_id = self._hardware.get_fingerprint()
        old_hardware_id = None
        if self._status and self._status.hardware_id:
            old_hardware_id = self._status.hardware_id
        if not old_hardware_id:
            cached = self._cache.get_license_status()
            if cached and cached.get('hardware_id'):
                old_hardware_id = cached.get('hardware_id')
        if not old_hardware_id:
            raise RuntimeError("Current hardware_id unavailable. Cannot replace device.")
        if old_hardware_id == new_hardware_id:
            return {'success': False, 'message': 'Old and new hardware IDs are identical.'}
        result = self._client.replace_device(
            license_key=self._license_key,
            new_hardware_id=new_hardware_id,
            old_hardware_id=old_hardware_id,
            device_name=device_name
        )
        if result.get('success'):
            self._cache.invalidate_license_status()
            data = result.get('data', result)
            self._status = LicenseStatus(
                valid=True,
                status=data.get('status', 'active'),
                expiry_date=data.get('expiry_date'),
                days_left=data.get('days_left', 0),
                plan=data.get('plan'),
                hardware_id=new_hardware_id,
                license_key=self._license_key,
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile'),
                message='Hardware replaced'
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def bind_device(self, license_key: Optional[str] = None, device_name: Optional[str] = None) -> Dict[str, Any]:
        key = license_key or self._license_key
        if not key:
            raise ValueError("License key unavailable.")
        result = self._client.bind_device(key, device_name=device_name)
        if result.get('success'):
            self._license_key = key
            data = result.get('data', result)
            hardware_id = self._hardware.get_fingerprint()
            self._status = LicenseStatus(
                valid=True,
                status=data.get('status', 'active'),
                expiry_date=data.get('expiry_date'),
                days_left=data.get('days_left', 0),
                plan=data.get('plan'),
                hardware_id=hardware_id,
                license_key=key,
                customer_name=data.get('customer_name'),
                customer_email=data.get('customer_email'),
                customer_phone=data.get('customer_phone'),
                customer_mobile=data.get('customer_mobile'),
                message='Device bound'
            )
            if self._status.valid:
                self._cache.set_license_status(self._status.to_dict())
        return result

    def verify_license_for_renewal(self, license_key: str) -> Dict[str, Any]:
        return self._client.verify_license_for_renewal(license_key)

    def get_license_details(self, license_key: str) -> Dict[str, Any]:
        return self._client.get_license_details(license_key)

    def send_renewal_request(self, license_key: str, customer_name: str = '',
                             email: str = '', mobile: str = '',
                             subject: str = '', message: str = '',
                             request_type: str = 'renew') -> Dict[str, Any]:
        return self._client.send_renewal_request(
            license_key=license_key, customer_name=customer_name,
            email=email, mobile=mobile, subject=subject,
            message=message, request_type=request_type,
        )
`,
    'activation.py': `"""Activation Dialog - standalone license activation window"""
import json
import os
import platform
import socket
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Any, Dict, List, Optional

from .client import ApiClient
from .hardware import HardwareDetector
from .cache import CacheManager


def _load_api_config() -> Dict[str, Any]:
    cfg_paths = [
        os.path.join(os.path.dirname(__file__), 'config', 'api-config.json'),
        os.path.join(os.getcwd(), 'config', 'api-config.json'),
    ]
    for cfg_path in cfg_paths:
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            continue
    return {}


class StatusBadge(tk.Canvas):
    def __init__(self, parent, text, color, bg):
        self._color = color
        self._text = text
        super().__init__(parent, width=0, height=28, bg=bg, highlightthickness=0)
        self._draw(text, color)

    def _draw(self, text, color):
        self.delete('all')
        self._color = color
        self._text = text
        w = len(text) * 9 + 28
        r = 12
        self.config(width=w)
        self.create_rounded_rect(0, 0, w, 28, r, fill=color, outline=color)
        self.create_text(w // 2, 14, text=text, fill='white',
                          font=('Segoe UI', 10, 'bold'))

    def set(self, text, color):
        self._draw(text, color)

    def create_rounded_rect(self, x1, y1, x2, y2, r, **kw):
        points = [x1+r, y1, x2-r, y1, x2, y1, x2, y1+r,
                  x2, y2-r, x2, y2, x2-r, y2, x1+r, y2,
                  x1, y2, x1, y2-r, x1, y1+r, x1, y1]
        return self.create_polygon(points, smooth=True, **kw)


class ActionButton(tk.Canvas):
    def __init__(self, parent, text, color, command, width=160, height=42, **kw):
        self._color = color
        self._hover_color = self._adjust_color(color, 1.2)
        self._disabled_color = '#9ca3af'
        self._cmd = command
        self._disabled = False
        self._loading = False
        self._text = text
        r = 12
        super().__init__(parent, width=width, height=height, bg=parent.cget('bg'),
                          highlightthickness=0, **kw)
        self._width = width
        self._height = height
        self._r = r
        self._draw_normal()
        self.bind('<Button-1>', self._on_click)
        self.bind('<Enter>', self._on_enter)
        self.bind('<Leave>', self._on_leave)
        self.bind('<ButtonRelease-1>', lambda e: self._draw_normal() if not self._disabled and not self._loading else None)
        self.configure(cursor='hand2')

    @staticmethod
    def _adjust_color(hex_color, factor):
        hex_color = hex_color.lstrip('#')
        r = min(255, int(int(hex_color[0:2], 16) * factor))
        g = min(255, int(int(hex_color[2:4], 16) * factor))
        b = min(255, int(int(hex_color[4:6], 16) * factor))
        return f'#{r:02x}{g:02x}{b:02x}'

    def _draw_normal(self):
        self.delete('all')
        c = self._disabled_color if self._disabled else self._color
        self.create_rounded_rect(0, 0, self._width, self._height, self._r, fill=c, outline=c)
        text = 'Loading...' if self._loading else self._text
        self.create_text(self._width // 2, self._height // 2, text=text,
                          fill='white', font=('Segoe UI', 10, 'bold'))

    def create_rounded_rect(self, x1, y1, x2, y2, r, **kw):
        points = [x1+r, y1, x2-r, y1, x2, y1, x2, y1+r,
                  x2, y2-r, x2, y2, x2-r, y2, x1+r, y2,
                  x1, y2, x1, y2-r, x1, y1+r, x1, y1]
        return self.create_polygon(points, smooth=True, **kw)

    def _on_enter(self, event):
        if not self._disabled and not self._loading:
            self._draw_hover()

    def _on_leave(self, event):
        if not self._disabled and not self._loading:
            self._draw_normal()

    def _draw_hover(self):
        self.delete('all')
        c = self._hover_color
        self.create_rounded_rect(0, 0, self._width, self._height, self._r, fill=c, outline=c)
        self.create_text(self._width // 2, self._height // 2, text=self._text,
                          fill='white', font=('Segoe UI', 10, 'bold'))

    def _on_click(self, event):
        if not self._disabled and not self._loading:
            self._cmd()

    def set_disabled(self, disabled):
        self._disabled = disabled
        self._draw_normal()

    def set_loading(self, loading):
        self._loading = loading
        self._draw_normal()

    def set_text(self, text):
        self._text = text
        if not self._loading:
            self._draw_normal()


class ActivationDialog:
    def __init__(self, client: ApiClient, product_name: Optional[str] = None,
                 cache: Optional[CacheManager] = None):
        self.config = _load_api_config()
        self.client = client
        self.product_name = product_name or self.config.get('product', {}).get('name', '')
        self.cache = cache or CacheManager(self.config)
        self.hardware = HardwareDetector()
        self._root: Optional[tk.Toplevel] = None
        self._hardware_id: Optional[str] = None
        self._device_name: str = socket.gethostname()
        self._platform: str = platform.system() or 'Unknown'
        self._license_key: Optional[str] = None
        self._validate_data: Optional[Dict[str, Any]] = None
        self._trial_data: Optional[Dict[str, Any]] = None
        self._activated: bool = False
        self._cancelled: bool = False
        self._customer_data: Dict[str, str] = {}
        self._customer_name_var = tk.StringVar(value='')
        self._customer_email_var = tk.StringVar(value='')
        self._customer_phone_var = tk.StringVar(value='')
        self._products: List[Dict[str, Any]] = []
        self._plans_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._product_ids: List[str] = []
        self._plan_ids: List[str] = []
        self._init_completed = {'hardware': False, 'products': False}
        self._initialized = False
        self._hardware_ok = False
        self._products_ok = False
        self.branding = self.config.get('branding', {})
        self._primary = '#1e40af'
        self._secondary = '#6b7280'
        self._bg = '#f5f7fb'
        self._card_bg = '#ffffff'
        self._text_primary = '#111827'
        self._text_secondary = '#6b7280'
        self._success = '#16a34a'
        self._warning = '#ea580c'
        self._error = '#dc2626'
        self._border = '#dbe3ef'
        self._badge_inactive = '#9ca3af'
        self._badge_verified = '#16a34a'
        self._badge_bound = '#16a34a'
        self._badge_failed = '#dc2626'

    def show(self) -> Dict[str, Any]:
        self._root = tk.Toplevel()
        self._root.title('UNIVERSAL LICENSE ACTIVATION')
        self._root.geometry('700x760')
        self._root.minsize(560, 680)
        self._root.resizable(True, True)
        self._root.configure(bg=self._bg)
        self._root.transient()
        self._root.grab_set()
        self._root.protocol('WM_DELETE_WINDOW', self._on_closing)
        style = ttk.Style(self._root)
        style.theme_use('clam')
        style.configure('TScrollbar', background=self._card_bg, troughcolor=self._bg,
                         bordercolor=self._border, arrowcolor=self._text_secondary,
                         relief='flat')
        self._build_ui()
        self._center_window()
        self._status_label.config(text='Loading license information...')
        self._set_controls_disabled(True)
        self._root.after(200, self._initialize)
        self._root.wait_window()
        return {
            'activated': self._activated,
            'cancelled': self._cancelled,
            'license_key': self._license_key,
        }

    def _center_window(self):
        if not self._root:
            return
        self._root.update_idletasks()
        w = self._root.winfo_width()
        h = self._root.winfo_height()
        x = (self._root.winfo_screenwidth() // 2) - (w // 2)
        y = (self._root.winfo_screenheight() // 2) - (h // 2)
        self._root.geometry(f'{w}x{h}+{x}+{y}')

    def _make_card(self, parent, title):
        frame = tk.Frame(parent, bg=self._card_bg, highlightbackground=self._border,
                          highlightcolor=self._border, highlightthickness=2)
        header = tk.Frame(frame, bg=self._card_bg)
        header.pack(fill='x', padx=20, pady=(14, 4))
        tk.Label(header, text=title, font=('Segoe UI', 12, 'bold'),
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        sep = tk.Frame(frame, bg=self._border, height=1)
        sep.pack(fill='x', padx=20, pady=(0, 8))
        body = tk.Frame(frame, bg=self._card_bg)
        body.pack(fill='x', padx=20, pady=(0, 14))
        return frame, body

    def _build_ui(self):
        root = self._root

        header_frame = tk.Frame(root, bg=self._bg)
        header_frame.pack(fill='x', padx=24, pady=(24, 6))
        tk.Label(header_frame, text='UNIVERSAL LICENSE ACTIVATION',
                  font=('Segoe UI', 20, 'bold'), bg=self._bg, fg=self._text_primary).pack(anchor='w')
        tk.Label(header_frame, text='Activate your license on this device',
                  font=('Segoe UI', 10), bg=self._bg, fg=self._text_secondary).pack(anchor='w', pady=(1, 0))

        canvas = tk.Canvas(root, bg=self._bg, highlightthickness=0)
        scrollbar = ttk.Scrollbar(root, orient='vertical', command=canvas.yview)
        scroll_frame = tk.Frame(canvas, bg=self._bg)
        scroll_frame.bind('<Configure>', lambda e: canvas.configure(scrollregion=canvas.bbox('all')))
        self._canvas_window = canvas.create_window((0, 0), window=scroll_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side='left', fill='both', expand=True, padx=(24, 0), pady=(0, 10))
        scrollbar.pack(side='right', fill='y', padx=(0, 24), pady=(0, 10))

        def _on_canvas_configure(event):
            canvas.itemconfig(self._canvas_window, width=event.width - 4)
        canvas.bind('<Configure>', _on_canvas_configure)

        _F = ('Segoe UI', 10)
        _FB = ('Segoe UI', 10, 'bold')
        _FC = ('Courier', 10)

        # Hardware Card
        hw_card, hw_body = self._make_card(scroll_frame, 'Hardware')

        self._hw_status = tk.Label(hw_body, text='Fetching hardware information...',
                                    font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._hw_status.pack(anchor='w', pady=(0, 12))

        hw_info_frame = tk.Frame(hw_body, bg=self._card_bg)
        hw_info_frame.pack(fill='x')
        self._hw_id_label = tk.Label(hw_info_frame, text='Hardware ID: --',
                                      font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._hw_id_label.pack(anchor='w', pady=(1, 0))
        self._hw_device_label = tk.Label(hw_info_frame, text=f'Device: {self._device_name}',
                                          font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._hw_device_label.pack(anchor='w', pady=(1, 0))
        self._hw_platform_label = tk.Label(hw_info_frame, text=f'Platform: {self._platform}',
                                            font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._hw_platform_label.pack(anchor='w', pady=(1, 0))

        bound_row = tk.Frame(hw_body, bg=self._card_bg)
        bound_row.pack(fill='x', pady=(8, 0))
        tk.Label(bound_row, text='Device Bound:', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(side='left')
        self._hw_bound_badge = StatusBadge(bound_row, 'Not Bound', self._badge_inactive, self._card_bg)
        self._hw_bound_badge.pack(side='left', padx=(6, 0))

        hw_card.pack(fill='x', pady=(0, 18))

        # Customer Card
        c_card, c_body = self._make_card(scroll_frame, 'Customer')

        cname_row = tk.Frame(c_body, bg=self._card_bg)
        cname_row.pack(fill='x', pady=(0, 12))
        tk.Label(cname_row, text='Customer Name', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._customer_name_entry = tk.Entry(cname_row, textvariable=self._customer_name_var,
                                               font=_F, relief='solid', bd=2,
                                               highlightthickness=2,
                                               highlightbackground=self._border,
                                               highlightcolor=self._primary,
                                               disabledbackground='#f3f4f6',
                                               disabledforeground='#9ca3af',
                                               state='disabled')
        self._customer_name_entry.pack(fill='x', ipady=4, pady=(4, 0))
        self._customer_name_entry.bind('<FocusIn>', lambda e: self._customer_name_entry.config(highlightbackground=self._primary))
        self._customer_name_entry.bind('<FocusOut>', lambda e: self._customer_name_entry.config(highlightbackground=self._border))

        cemail_row = tk.Frame(c_body, bg=self._card_bg)
        cemail_row.pack(fill='x', pady=(0, 12))
        tk.Label(cemail_row, text='Email', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._customer_email_entry = tk.Entry(cemail_row, textvariable=self._customer_email_var,
                                                font=_F, relief='solid', bd=2,
                                                highlightthickness=2,
                                                highlightbackground=self._border,
                                                highlightcolor=self._primary,
                                                disabledbackground='#f3f4f6',
                                                disabledforeground='#9ca3af',
                                                state='disabled')
        self._customer_email_entry.pack(fill='x', ipady=4, pady=(4, 0))
        self._customer_email_entry.bind('<FocusIn>', lambda e: self._customer_email_entry.config(highlightbackground=self._primary))
        self._customer_email_entry.bind('<FocusOut>', lambda e: self._customer_email_entry.config(highlightbackground=self._border))

        cphone_row = tk.Frame(c_body, bg=self._card_bg)
        cphone_row.pack(fill='x', pady=(0, 0))
        tk.Label(cphone_row, text='Mobile Number', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._customer_phone_entry = tk.Entry(cphone_row, textvariable=self._customer_phone_var,
                                                font=_F, relief='solid', bd=2,
                                                highlightthickness=2,
                                                highlightbackground=self._border,
                                                highlightcolor=self._primary,
                                                disabledbackground='#f3f4f6',
                                                disabledforeground='#9ca3af',
                                                state='disabled')
        self._customer_phone_entry.pack(fill='x', ipady=4, pady=(4, 0))
        self._customer_phone_entry.bind('<FocusIn>', lambda e: self._customer_phone_entry.config(highlightbackground=self._primary))
        self._customer_phone_entry.bind('<FocusOut>', lambda e: self._customer_phone_entry.config(highlightbackground=self._border))

        c_card.pack(fill='x', pady=(0, 18))

        # Trial Card
        t_card, t_body = self._make_card(scroll_frame, 'Trial')

        trial_grid = tk.Frame(t_body, bg=self._card_bg)
        trial_grid.pack(fill='x')
        self._trial_started_label = tk.Label(trial_grid, text='Started: --',
                                              font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._trial_started_label.pack(anchor='w', pady=(1, 0))
        self._trial_ends_label = tk.Label(trial_grid, text='Ends: --',
                                           font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._trial_ends_label.pack(anchor='w', pady=(1, 0))
        self._trial_days_label = tk.Label(trial_grid, text='Days Remaining: --',
                                           font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._trial_days_label.pack(anchor='w', pady=(1, 0))

        tstatus_row = tk.Frame(t_body, bg=self._card_bg)
        tstatus_row.pack(fill='x', pady=(4, 0))
        tk.Label(tstatus_row, text='Trial Status:', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(side='left')
        self._trial_badge = StatusBadge(tstatus_row, '--', self._badge_inactive, self._card_bg)
        self._trial_badge.pack(side='left', padx=(6, 0))

        t_card.pack(fill='x', pady=(0, 18))

        # License Card
        l_card, l_body = self._make_card(scroll_frame, 'License')

        product_row = tk.Frame(l_body, bg=self._card_bg)
        product_row.pack(fill='x', pady=(0, 12))
        tk.Label(product_row, text='Product', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._product_combo = ttk.Combobox(product_row, font=_F, state='disabled')
        self._product_combo.pack(fill='x', pady=(4, 0))
        self._product_combo.bind('<<ComboboxSelected>>', self._on_product_selected)

        plan_row = tk.Frame(l_body, bg=self._card_bg)
        plan_row.pack(fill='x', pady=(0, 12))
        tk.Label(plan_row, text='Plan', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._plan_combo = ttk.Combobox(plan_row, font=_F, state='disabled')
        self._plan_combo.pack(fill='x', pady=(4, 0))

        lk_row = tk.Frame(l_body, bg=self._card_bg)
        lk_row.pack(fill='x', pady=(0, 12))
        tk.Label(lk_row, text='License Key', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._license_entry = tk.Entry(lk_row, font=_FC, relief='solid',
                                         bd=2, highlightthickness=2,
                                         highlightbackground=self._border,
                                         highlightcolor=self._primary,
                                         disabledbackground='#f3f4f6',
                                         disabledforeground='#9ca3af',
                                         state='disabled')
        self._license_entry.pack(fill='x', ipady=4, pady=(4, 0))
        self._license_entry.bind('<FocusIn>', lambda e: self._license_entry.config(highlightbackground=self._primary))
        self._license_entry.bind('<FocusOut>', lambda e: self._license_entry.config(highlightbackground=self._border))

        expiry_row = tk.Frame(l_body, bg=self._card_bg)
        expiry_row.pack(fill='x', pady=(0, 12))
        tk.Label(expiry_row, text='License Expiry', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._expiry_var = tk.StringVar(value='--')
        tk.Label(expiry_row, textvariable=self._expiry_var,
                  font=_F, bg=self._card_bg, fg=self._text_secondary).pack(anchor='w', pady=(4, 0))

        astatus_row = tk.Frame(l_body, bg=self._card_bg)
        astatus_row.pack(fill='x', pady=(0, 12))
        tk.Label(astatus_row, text='Activation Status:', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(side='left')
        self._activation_badge = StatusBadge(astatus_row, 'Inactive', self._badge_inactive, self._card_bg)
        self._activation_badge.pack(side='left', padx=(6, 0))

        dev_row = tk.Frame(l_body, bg=self._card_bg)
        dev_row.pack(fill='x', pady=(0, 0))
        tk.Label(dev_row, text='Device Limit', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(anchor='w')
        self._device_limit_var = tk.StringVar(value='-- / --')
        tk.Label(dev_row, textvariable=self._device_limit_var,
                  font=_F, bg=self._card_bg, fg=self._text_secondary).pack(anchor='w', pady=(4, 0))

        lic_days_row = tk.Frame(l_body, bg=self._card_bg)
        lic_days_row.pack(fill='x', pady=(8, 0))
        tk.Label(lic_days_row, text='Days Remaining:', font=_FB,
                  bg=self._card_bg, fg=self._text_primary).pack(side='left')
        self._license_days_label = tk.Label(lic_days_row, text='--',
                                              font=_F, bg=self._card_bg, fg=self._text_secondary)
        self._license_days_label.pack(side='left', padx=(6, 0))

        l_card.pack(fill='x', pady=(0, 18))

        # Status label
        self._status_label = tk.Label(scroll_frame, text='Detecting hardware...',
                                        font=_F, bg=self._bg, fg=self._text_secondary)
        self._status_label.pack(anchor='w', pady=(0, 12))

        # Buttons
        btn_frame = tk.Frame(scroll_frame, bg=self._bg)
        btn_frame.pack(fill='x', pady=(0, 10))

        self._refresh_btn = ActionButton(btn_frame, 'Refresh', self._secondary,
                                           self._on_refresh, width=140, height=42)
        self._refresh_btn.pack(side='left', padx=(0, 10))
        self._refresh_btn.set_disabled(True)

        self._activate_btn = ActionButton(btn_frame, 'Activate License', self._primary,
                                            self._on_activate, width=170, height=42)
        self._activate_btn.pack(side='left')
        self._activate_btn.set_disabled(True)

        # Device Binding Notice
        warn_bg = '#fef2f2'
        warn_border = '#fecaca'
        warn_text = '#991b1b'
        warn_text2 = '#7f1d1d'
        warning_frame = tk.Frame(scroll_frame, bg=warn_bg, highlightbackground=warn_border,
                                  highlightcolor=warn_border, highlightthickness=2)
        warning_frame.pack(fill='x', pady=(0, 18))

        warn_header = tk.Frame(warning_frame, bg=warn_bg)
        warn_header.pack(fill='x', padx=20, pady=(14, 4))
        tk.Label(warn_header, text='\u26a0 Device Binding Notice',
                  font=('Segoe UI', 12, 'bold'), bg=warn_bg, fg=warn_text).pack(anchor='w')

        warn_sep = tk.Frame(warning_frame, bg=warn_border, height=1)
        warn_sep.pack(fill='x', padx=20, pady=(0, 8))

        warn_body = tk.Frame(warning_frame, bg=warn_bg)
        warn_body.pack(fill='x', padx=20, pady=(0, 14))

        support_email = (self.config.get('branding', {})
                         .get('support_email', 'support@websmithdigital.com'))
        tk.Label(warn_body,
                 text='This device will be permanently linked to this license.',
                 font=_F, bg=warn_bg, fg=warn_text2,
                 wraplength=660, justify='left').pack(anchor='w', pady=(0, 3))
        tk.Label(warn_body,
                 text='For device replacement or hardware unbinding, contact:',
                 font=_F, bg=warn_bg, fg=warn_text,
                 wraplength=660, justify='left').pack(anchor='w')
        tk.Label(warn_body,
                 text=support_email,
                 font=('Segoe UI', 10, 'underline'), bg=warn_bg,
                 fg=self._primary, cursor='hand2',
                 wraplength=660, justify='left').pack(anchor='w')

        company = self.branding.get('company_name', '') or self.product_name or 'License'
        footer = tk.Label(root, text=f'Protected by {company}',
                           font=('Segoe UI', 9), bg=self._bg, fg='#9ca3af')
        footer.pack(side='bottom', pady=(0, 14))

    def _initialize(self):
        self._init_completed = {'hardware': False, 'products': False}
        self._root.after(0, self._detect_hardware)
        self._root.after(0, self._fetch_products)

    def _try_enable(self):
        if all(self._init_completed.values()) and not self._initialized:
            self._initialized = True
            if self._hardware_ok and self._products_ok:
                self._set_controls_disabled(False)
                self._status_label.config(
                    text='Initialization complete. Refreshing trial/license data...',
                    fg=self._text_secondary
                )
                self._root.after(100, self._auto_fetch_trial)
            else:
                reasons = []
                if not self._hardware_ok:
                    reasons.append('hardware detection failed')
                if not self._products_ok:
                    reasons.append('no products available')
                self._status_label.config(
                    text=f'Initialization failed: {"; ".join(reasons)}. Close and retry.',
                    fg=self._error
                )

    def _auto_fetch_trial(self):
        try:
            trial_result = self.client.get_trial_status(self._hardware_id)
            trial_data = trial_result.get('data', {})
            if trial_data.get('has_trial'):
                self._update_ui(trial_data)
                self._status_label.config(
                    text=f"Trial active — {trial_data.get('days_left', 0)} day(s) remaining. Enter license key to activate.",
                    fg=self._success
                )
                self._activate_btn.set_disabled(False)
        except Exception:
            pass

    def _detect_hardware(self):
        try:
            self._hardware_id = self.hardware.get_fingerprint()
            if not self._hardware_id:
                self._hw_status.config(text='Unable to detect hardware. Please retry.', fg=self._error)
                self._status_label.config(text='Hardware detection failed. Close and retry.', fg=self._error)
                self._hardware_ok = False
                return
            self._hw_id_label.config(text=f'Hardware ID: {self._hardware_id}')
            self._hw_status.config(text='Hardware verified. Activation available.', fg=self._success)
            self._hardware_ok = True
        except Exception as e:
            self._hw_status.config(text=f'Unable to detect hardware: {str(e)}', fg=self._error)
            self._status_label.config(text=f'Hardware error: {str(e)}', fg=self._error)
            self._hardware_ok = False
        finally:
            self._init_completed['hardware'] = True
            self._try_enable()

    def _fetch_products(self):
        try:
            result = self.client.get_products()
            products = result.get('products', []) if result.get('success') else result.get('products', [])
            if not products:
                self._status_label.config(text='No products available from server.', fg=self._error)
                self._products_ok = False
                return
            self._products = products
            self._plans_cache = {}
            names = []
            self._product_ids = []
            for p in products:
                pid = p.get('id', p.get('product_id', ''))
                name = p.get('name', '')
                names.append(name)
                self._product_ids.append(pid)
                plans = p.get('plans', [])
                self._plans_cache[pid] = plans
            self._product_combo['values'] = names
            self._products_ok = True
            if names:
                self._product_combo.set(names[0])
                self._on_product_selected()
        except Exception as e:
            self._status_label.config(text=f'Failed to load products: {str(e)}', fg=self._error)
            self._products_ok = False
        finally:
            self._init_completed['products'] = True
            self._try_enable()

    def _on_product_selected(self, event=None):
        name = self._product_combo.get()
        pid = ''
        for i, pname in enumerate(self._product_combo['values']):
            if pname == name:
                if i < len(self._product_ids):
                    pid = self._product_ids[i]
                break
        plans = self._plans_cache.get(pid, [])
        plan_names = [pl.get('name', '') for pl in plans]
        self._plan_ids = [str(pl.get('id', '')) for pl in plans]
        self._plan_combo['values'] = plan_names
        if plan_names:
            self._plan_combo.set(plan_names[0])
        else:
            self._plan_combo.set('')
        self._plan_combo.state(['!disabled'] if plan_names else ['disabled'])

    def _set_controls_disabled(self, disabled: bool):
        self._refresh_btn.set_disabled(disabled)
        self._activate_btn.set_disabled(disabled)
        state = 'disabled' if disabled else 'normal'
        self._license_entry.config(state=state)
        self._product_combo.state(['disabled'] if disabled else ['!disabled'])
        if not disabled and self._plan_combo['values']:
            self._plan_combo.state(['!disabled'])
        else:
            self._plan_combo.state(['disabled'])
        if hasattr(self, '_customer_name_entry'):
            self._customer_name_entry.config(state=state)
            self._customer_email_entry.config(state=state)
            self._customer_phone_entry.config(state=state)

    def _on_closing(self):
        if not self._activated:
            self._cancelled = True
        try:
            self._root.destroy()
        except Exception:
            pass

    def _get_selected_product_id(self) -> str:
        name = self._product_combo.get()
        for i, pname in enumerate(self._product_combo['values']):
            if pname == name:
                if i < len(self._product_ids):
                    return self._product_ids[i]
        return ''

    def _get_selected_plan_id(self) -> str:
        name = self._plan_combo.get()
        for i, pname in enumerate(self._plan_combo['values']):
            if pname == name:
                if i < len(self._plan_ids):
                    return self._plan_ids[i]
        return ''

    def _get_selected_plan_name(self) -> str:
        return self._plan_combo.get()

    def _on_refresh(self):
        license_key = self._license_entry.get().strip()
        self._refresh_btn.set_loading(True)
        self._root.update()
        try:
            if license_key:
                self._status_label.config(text='Validating license...', fg=self._text_secondary)
                result = self.client.validate_license(license_key, self._hardware_id)
                if result.get('valid') or result.get('data', {}).get('valid'):
                    data = result.get('data', result)
                    self._validate_data = data
                    self._license_key = license_key
                    self._update_ui(data)

                    # Auto-detect product + plan from validated license data
                    api_plan = data.get('plan', '')
                    if api_plan:
                        found = False
                        for pid, plans in self._plans_cache.items():
                            for pl in plans:
                                if pl.get('name') == api_plan:
                                    for i, pname in enumerate(self._product_combo['values']):
                                        if i < len(self._product_ids) and self._product_ids[i] == pid:
                                            self._product_combo.set(pname)
                                            self._on_product_selected()
                                            self._plan_combo.set(api_plan)
                                            found = True
                                            break
                                    if found:
                                        break
                            if found:
                                break

                    self._status_label.config(text='License validated successfully. All fields auto-filled.', fg=self._success)
                    self._activate_btn.set_disabled(False)
                    self._fetch_trial_status()
                else:
                    err_msg = result.get('message', result.get('error', 'License validation failed'))
                    self._status_label.config(text=f'Validation failed: {err_msg}', fg=self._error)
            else:
                # No license key — try fetching trial info
                trial_result = self.client.get_trial_status(self._hardware_id)
                trial_data = trial_result.get('data', {})
                if trial_data.get('has_trial'):
                    self._update_ui(trial_data)
                    self._status_label.config(
                        text=f"Trial active — {trial_data.get('days_left', 0)} day(s) remaining. Enter license key to activate.",
                        fg=self._success
                    )
                    self._activate_btn.set_disabled(False)
                else:
                    self._status_label.config(text='No license key and no active trial found.', fg=self._error)
        except Exception as e:
            self._status_label.config(text=f'Refresh error: {str(e)}', fg=self._error)
        finally:
            self._refresh_btn.set_loading(False)

    def _fetch_trial_status(self):
        try:
            trial_result = self.client.get_trial_status(self._hardware_id)
            if isinstance(trial_result, dict) and trial_result.get('data', {}).get('has_trial'):
                data = trial_result['data']
                self._trial_data = data
                self._trial_started_label.config(
                    text=f"Started: {data.get('started_at', '--')}"
                )
                self._trial_ends_label.config(
                    text=f"Ends: {data.get('expiry_date', '--')}"
                )
                self._trial_days_label.config(
                    text=f"Days Remaining: {data.get('days_left', 0)}"
                )
                status = data.get('status', 'unknown')
                status_color = self._badge_verified if status == 'active' else self._badge_failed
                label = 'Active' if status == 'active' else status.capitalize()
                self._trial_badge.set(label, status_color)
        except Exception:
            self._trial_badge.set('Unavailable', self._badge_inactive)

    def _update_ui(self, data: Dict[str, Any]):
        cname = data.get('customer_name') or data.get('customerName', '')
        cemail = data.get('customer_email') or data.get('customerEmail', '')
        cphone = data.get('customer_phone') or data.get('customerPhone', '')
        self._customer_name_var.set(cname)
        self._customer_email_var.set(cemail)
        self._customer_phone_var.set(cphone)
        for entry in (self._customer_name_entry, self._customer_email_entry,
                       self._customer_phone_entry):
            entry.config(state='normal')
        self._customer_data = {'name': cname, 'email': cemail, 'phone': cphone}

        api_product = data.get('product_name', '')
        api_plan = data.get('plan', '')
        if api_product:
            self._product_combo.set(api_product)
        if api_plan:
            self._plan_combo.set(api_plan)
        expiry = data.get('expiry_date', '--')
        if expiry and 'T' in expiry:
            expiry = expiry.split('T')[0]
        self._expiry_var.set(expiry)

        days_left = data.get('days_left', data.get('days_remaining', 0))
        if days_left and days_left > 0:
            self._license_days_label.config(
                text=f'{days_left} day(s) left',
                fg=self._success
            )
        elif days_left == 0 and expiry and expiry != '--':
            self._license_days_label.config(text='Expired', fg=self._error)
        else:
            self._license_days_label.config(text='--', fg=self._text_secondary)

        max_dev = data.get('max_devices', '--')
        dev_count = data.get('device_count', data.get('active_devices', 0))
        self._device_limit_var.set(f'{dev_count} / {max_dev}')

        status = data.get('status', 'unknown')
        if status == 'active':
            self._activation_badge.set('Bound', self._badge_bound)
        else:
            self._activation_badge.set(status.capitalize(), self._badge_inactive)

    def _sync_customer(self) -> bool:
        name = self._customer_name_var.get().strip()
        email = self._customer_email_var.get().strip()
        phone = self._customer_phone_var.get().strip()
        if not name or not email:
            self._status_label.config(text='Customer name and email are required.', fg=self._error)
            return False
        try:
            result = self.client.update_customer(name, email, phone, self._hardware_id)
            if result.get('success'):
                self._customer_data = {'name': name, 'email': email, 'phone': phone}
                return True
            err = result.get('error', 'Failed to save customer')
            self._status_label.config(text=f'Customer sync failed: {err}', fg=self._error)
            return False
        except Exception as e:
            self._status_label.config(text=f'Customer sync error: {str(e)}', fg=self._error)
            return False

    def _on_activate(self):
        license_key = self._license_entry.get().strip()
        if not license_key:
            self._status_label.config(text='Please enter a license key.', fg=self._error)
            return
        if not self._hardware_id:
            self._status_label.config(text='Hardware not detected. Please restart.', fg=self._error)
            return
        if not self._validate_data:
            self._status_label.config(text='Please click Refresh first to validate the license.', fg=self._error)
            return
        max_dev = self._validate_data.get('max_devices', 0)
        dev_count = self._validate_data.get('device_count', self._validate_data.get('active_devices', 0))
        if max_dev and dev_count >= max_dev:
            self._status_label.config(
                text=f'Device limit reached ({dev_count}/{max_dev}). Deactivate another device first.',
                fg=self._error
            )
            return
        self._status_label.config(text='Syncing customer data...', fg=self._text_secondary)
        self._root.update()
        if not self._sync_customer():
            self._activate_btn.set_disabled(False)
            self._activate_btn.set_text('Activate License')
            return
        self._status_label.config(text='Activating license...', fg=self._text_secondary)
        self._activate_btn.set_loading(True)
        self._root.update()
        try:
            result = self.client.activate_license(license_key, self._hardware_id)
            if result.get('success') or result.get('data', {}).get('success'):
                data = result.get('data', result)
                self._activated = True
                self._license_key = license_key
                self._activation_badge.set('Bound', self._badge_bound)
                self._hw_bound_badge.set('Bound', self._badge_bound)
                msg = data.get('message', 'License activated successfully')
                if data.get('already_activated'):
                    msg = 'License already activated on this device'
                self._status_label.config(text=msg, fg=self._success)
                expiry = data.get('expiry_date', '--')
                if expiry and 'T' in expiry:
                    expiry = expiry.split('T')[0]
                self._expiry_var.set(expiry)
                dcount = data.get('device_count', 0)
                self._device_limit_var.set(f'{dcount} / {max_dev}')
                self.cache.save_license_key(license_key)
                self.cache.invalidate_license_status()
                self._root.destroy()
            else:
                err = result.get('message', result.get('error', 'Activation failed'))
                self._status_label.config(text=f'Activation failed: {err}', fg=self._error)
        except Exception as e:
            self._status_label.config(text=f'Activation error: {str(e)}', fg=self._error)
        finally:
            self._activate_btn.set_loading(False)
`,
    'welcome.py': `"""Welcome Dialog - tkinter onboarding dialog (reference implementation)"""
import json
import os
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Any, Dict, Optional

from .client import ApiClient
from .hardware import HardwareDetector
from .cache import CacheManager


_COUNTRIES_CACHE: list = []


def _load_api_config() -> Dict[str, Any]:
    cfg_paths = [
        os.path.join(os.path.dirname(__file__), 'config', 'api-config.json'),
        os.path.join(os.getcwd(), 'config', 'api-config.json'),
    ]
    for cfg_path in cfg_paths:
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            continue
    return {}


class WelcomeDialog:
    def __init__(self, client: ApiClient, product_name: Optional[str] = None,
                 cache: Optional[CacheManager] = None):
        self.config = _load_api_config()
        self.client = client
        self.product_name = product_name or self.config.get('product', {}).get('name', '')
        self.cache = cache or CacheManager(self.config)
        self.hardware = HardwareDetector()
        self._result: Optional[Dict[str, Any]] = None
        self._root: Optional[tk.Toplevel] = None
        self._countries = []
        self._selected_country = None
        self._otp_sent = False
        # Branding from config
        self.branding = self.config.get('branding', {})
        self._primary = self.branding.get('primary_color', '#6366f1')
        self._secondary = self.branding.get('secondary_color', '#4f46e5')
        self._bg = '#f0f2f5'
        self._card_bg = '#ffffff'
        self._text_primary = '#1a1a2e'
        self._text_secondary = '#6b7280'
        self._success = '#10b981'
        self._error = '#ef4444'
        self._border = '#d1d5db'
        # Feature flags
        self._trial_enabled = self.config.get('trial', {}).get('enabled', False)

    def is_onboarding_complete(self) -> bool:
        return self.cache.is_onboarding_complete()

    def show(self) -> Dict[str, Any]:
        if not self._trial_enabled:
            return {'skipped': True, 'message': 'Trial onboarding is not enabled'}
        if self.is_onboarding_complete():
            return {'skipped': True, 'message': 'Onboarding already completed'}
        self._result = None
        self._root = tk.Toplevel()
        self._root.title(self.product_name or 'License')
        self._root.geometry('480x580')
        self._root.resizable(False, False)
        self._root.configure(bg=self._bg)
        self._root.transient()  # Make transient to parent
        self._root.grab_set()   # Modal
        self._root.protocol('WM_DELETE_WINDOW', self._on_closing)
        self._build_ui()
        self._center_window()
        self._load_countries()
        self._root.wait_window()
        return self._result or {'skipped': True}

    def _center_window(self):
        if not self._root:
            return
        self._root.update_idletasks()
        w = self._root.winfo_width()
        h = self._root.winfo_height()
        x = (self._root.winfo_screenwidth() // 2) - (w // 2)
        y = (self._root.winfo_screenheight() // 2) - (h // 2)
        self._root.geometry(f'{w}x{h}+{x}+{y}')

    def _build_ui(self):
        root = self._root
        header = tk.Label(root, text='Welcome', font=('Helvetica', 22, 'bold'),
                          bg=self._bg, fg=self._text_primary)
        header.pack(pady=(30, 5))
        sub = tk.Label(root, text='Complete your registration to start the trial',
                       font=('Helvetica', 11), bg=self._bg, fg=self._text_secondary)
        sub.pack(pady=(0, 20))
        frame = tk.Frame(root, bg=self._card_bg, bd=1, relief='solid',
                         highlightbackground=self._border)
        frame.pack(fill='both', expand=True, padx=30, pady=(0, 20))
        padding = {'padx': 20, 'pady': 5}
        tk.Label(frame, text='Name *', font=('Helvetica', 11, 'bold'),
                 fg=self._text_primary, bg=self._card_bg).pack(anchor='w', **padding)
        self._name_entry = tk.Entry(frame, font=('Helvetica', 12), relief='solid',
                                     bd=1, highlightbackground=self._border)
        self._name_entry.pack(fill='x', padx=20, pady=(0, 10))
        self._name_entry.focus()
        tk.Label(frame, text='Email *', font=('Helvetica', 11, 'bold'),
                 fg=self._text_primary, bg=self._card_bg).pack(anchor='w', **padding)
        self._email_entry = tk.Entry(frame, font=('Helvetica', 12), relief='solid',
                                      bd=1, highlightbackground=self._border)
        self._email_entry.pack(fill='x', padx=20, pady=(0, 10))
        tk.Label(frame, text='Mobile Number *', font=('Helvetica', 11, 'bold'),
                 fg=self._text_primary, bg=self._card_bg).pack(anchor='w', **padding)
        mobile_frame = tk.Frame(frame, bg=self._card_bg)
        mobile_frame.pack(fill='x', padx=20, pady=(0, 10))
        self._country_var = tk.StringVar()
        self._country_menu = ttk.Combobox(mobile_frame, textvariable=self._country_var,
                                           width=14, state='readonly', font=('Helvetica', 11))
        self._country_menu.pack(side='left')
        self._mobile_entry = tk.Entry(mobile_frame, font=('Helvetica', 12), relief='solid',
                                       bd=1, highlightbackground=self._border)
        self._mobile_entry.pack(side='left', fill='x', expand=True, padx=(8, 0))
        tk.Label(frame, text='Company (optional)', font=('Helvetica', 11, 'bold'),
                 fg=self._text_secondary, bg=self._card_bg).pack(anchor='w', **padding)
        self._company_entry = tk.Entry(frame, font=('Helvetica', 12), relief='solid',
                                        bd=1, highlightbackground=self._border)
        self._company_entry.pack(fill='x', padx=20, pady=(0, 15))
        self._status_label = tk.Label(frame, text='', font=('Helvetica', 10),
                                       bg=self._card_bg, fg=self._success)
        self._status_label.pack(padx=20, pady=(0, 5))
        self._send_btn = tk.Button(frame, text='Send OTP', font=('Helvetica', 12, 'bold'),
                                    bg=self._primary, fg='white', relief='flat',
                                    command=self._on_send_otp, cursor='hand2')
        self._send_btn.pack(fill='x', padx=20, pady=(0, 8))
        otp_frame = tk.Frame(frame, bg=self._card_bg)
        otp_frame.pack(fill='x', padx=20, pady=(0, 5))
        self._otp_entry = tk.Entry(otp_frame, font=('Helvetica', 16), relief='solid',
                                    bd=1, highlightbackground=self._border,
                                    justify='center', width=10)
        self._otp_entry.pack(side='left', fill='x', expand=True)
        self._otp_entry.config(state='disabled')
        self._verify_btn = tk.Button(otp_frame, text='Verify', font=('Helvetica', 12, 'bold'),
                                      bg=self._success, fg='white', relief='flat',
                                      command=self._on_verify_otp, cursor='hand2',
                                      state='disabled')
        self._verify_btn.pack(side='left', padx=(8, 0))
        self._error_label = tk.Label(frame, text='', font=('Helvetica', 10),
                                      bg=self._card_bg, fg=self._error)
        self._error_label.pack(padx=20, pady=(5, 10))
        company = self.branding.get('company_name', '') or self.product_name or 'License'
        footer = tk.Label(self._root, text=f'Protected by {company}',
                          font=('Helvetica', 9), bg=self._bg, fg='#9ca3af')
        footer.pack(side='bottom', pady=(0, 15))

    def _load_countries(self):
        global _COUNTRIES_CACHE
        if _COUNTRIES_CACHE:
            self._set_countries(_COUNTRIES_CACHE)
            return
        try:
            result = self.client._request('countries', {'action': 'list'})
            if isinstance(result, dict) and result.get('data'):
                countries = result['data']
                if isinstance(countries, list) and countries:
                    _COUNTRIES_CACHE = countries
                    self._set_countries(countries)
                    return
        except Exception:
            pass
        self._set_countries([])

    def _set_countries(self, countries: list):
        self._countries = countries
        if not countries:
            return
        labels = [f"{c.get('dial', '')} {c.get('name', '')}" for c in countries]
        self._country_menu['values'] = labels
        self._country_menu.current(0)
        self._selected_country = countries[0] if countries else None

        def on_select(event):
            idx = self._country_menu.current()
            if 0 <= idx < len(countries):
                self._selected_country = countries[idx]

        self._country_menu.bind('<<ComboboxSelected>>', on_select)

    def _on_closing(self):
        self._result = {'skipped': True, 'closed': True}
        try:
            self._root.destroy()
        except Exception:
            pass

    def _on_send_otp(self):
        name = self._name_entry.get().strip()
        email = self._email_entry.get().strip()
        mobile = self._mobile_entry.get().strip()
        if not name:
            self._show_error('Name is required')
            return
        if not email or '@' not in email:
            self._show_error('Valid email is required')
            return
        if not mobile or len(mobile) < 4:
            self._show_error('Valid mobile number is required')
            return
        if not self._selected_country:
            self._show_error('Please select a country code')
            return
        self._send_btn.config(state='disabled', text='Sending...')
        self._clear_error()
        try:
            result = self.client._request('auth/otp/send', {'email': email})
            if result.get('success'):
                self._otp_sent = True
                self._status_label.config(text='OTP sent to your email', fg=self._success)
                self._otp_entry.config(state='normal')
                self._verify_btn.config(state='normal')
                self._send_btn.config(text='Resend OTP', state='normal')
            else:
                self._show_error(result.get('error', result.get('message', 'Failed to send OTP')))
                self._send_btn.config(state='normal', text='Send OTP')
        except Exception as e:
            self._show_error(str(e))
            self._send_btn.config(state='normal', text='Send OTP')

    def _on_verify_otp(self):
        email = self._email_entry.get().strip()
        otp = self._otp_entry.get().strip()
        if not otp or len(otp) < 4:
            self._show_error('Enter the OTP code')
            return
        self._verify_btn.config(state='disabled', text='Verifying...')
        self._clear_error()
        try:
            result = self.client._request('auth/otp/verify', {'email': email, 'otp': otp})
            if result.get('success'):
                self._complete_onboarding()
            else:
                self._show_error(result.get('error', result.get('message', 'Invalid OTP')))
                self._verify_btn.config(state='normal', text='Verify')
        except Exception as e:
            self._show_error(str(e))
            self._verify_btn.config(state='normal', text='Verify')

    def _complete_onboarding(self):
        name = self._name_entry.get().strip()
        email = self._email_entry.get().strip()
        mobile = self._mobile_entry.get().strip()
        company = self._company_entry.get().strip()
        country_code = self._selected_country.get('code', '') if self._selected_country else ''
        hardware_id = self.hardware.get_fingerprint()
        self._status_label.config(text='Activating trial...', fg=self._primary)
        self._root.update()
        try:
            self.client._request('customer/register', {
                'name': name, 'email': email, 'mobile': mobile,
                'country_code': country_code, 'company_name': company,
                'hardware_id': hardware_id
            })
            self.client.start_trial(email, name, {
                'mobile': mobile, 'country_code': country_code,
                'company_name': company, 'hardware_id': hardware_id
            })
            self.cache.set_onboarding_complete()
            self._result = {
                'name': name, 'email': email, 'hardware_id': hardware_id,
                'onboarding_complete': True
            }
            self._status_label.config(text='Trial activated! You can now use the software.', fg=self._success)
            self._root.after(2000, self._root.destroy)
        except Exception as e:
            self._show_error(str(e))
            self._verify_btn.config(state='normal', text='Verify')

    def _show_error(self, msg: str):
        self._error_label.config(text=msg)

    def _clear_error(self):
        self._error_label.config(text='')
`,
    'renewal.py': `"""Renewal Dialog for ${context.productName}"""
import threading
import tkinter as tk
from tkinter import ttk
from typing import Optional, Dict, Any


class RenewalDialog:
    def __init__(self, engine, license_key: str, parent=None):
        self.engine = engine; self.client = getattr(engine, '_client', None)
        self.config = getattr(engine, 'config', {})
        self._parent = parent
        self.license_key = license_key; self.engine._license_key = license_key
        self.result = None; self.root = None; self.plans = []; self._loading = False

    def show(self) -> Optional[Dict[str, Any]]:
        self._build_ui(); self.root.mainloop(); return self.result

    def _build_ui(self):
        branding = self.config.get('branding',{}); colors = branding.get('colors', {})
        primary = colors.get('primary', branding.get('primary_color','#6366f1')); bg=colors.get('bg_page','#f8f9fa')
        labels = branding.get('labels', {})
        if not self._parent:
            raise RuntimeError("SDK dialogs require the application root window as parent")
        self.root = tk.Toplevel(self._parent)
        self.root.transient(self._parent)
        self.root.grab_set()
        self.root.title(labels.get('renew_title', "Renew License")); self.root.geometry("450x500")
        self.root.resizable(False,False); self.root.configure(bg=bg)
        self.root.update_idletasks()
        sw=self.root.winfo_screenwidth(); sh=self.root.winfo_screenheight(); w=self.root.winfo_width(); h=self.root.winfo_height()
        self.root.geometry(f"+{(sw-w)//2}+{(sh-h)//2}")
        header=tk.Frame(self.root,bg=primary,height=60); header.pack(fill=tk.X); header.pack_propagate(False)
        tk.Label(header,text=labels.get('renew_title', "Renew License"),fg="white",bg=primary,font=("Helvetica",16,"bold")).pack(expand=True)
        form=tk.Frame(self.root,bg=bg,padx=25,pady=15); form.pack(fill=tk.BOTH,expand=True)

        tk.Label(form,text=labels.get('current_license_section', "Current License"),font=("Helvetica",11,"bold"),bg=bg,fg=colors.get('text_primary','#333')).pack(anchor=tk.W,pady=(0,5))
        cf=tk.Frame(form,bg=bg); cf.pack(fill=tk.X,pady=(0,10))
        s=self.engine.get_status()
        plan_lbl = labels.get('plan_label', 'Plan'); expiry_lbl = labels.get('expiry_label', 'Expiry')
        self.plan_lbl=tk.Label(cf,text=f"{plan_lbl}: {s.plan if s else labels.get('hardware_placeholder', '--')}",font=("Helvetica",10),bg=bg,fg=colors.get('text_secondary','#555')); self.plan_lbl.pack(anchor=tk.W)
        self.exp_lbl=tk.Label(cf,text=f"{expiry_lbl}: {s.expiry_date if s else labels.get('expiry_na', 'N/A')}",font=("Helvetica",10),bg=bg,fg=colors.get('text_secondary','#555')); self.exp_lbl.pack(anchor=tk.W)

        ttk.Separator(form,orient=tk.HORIZONTAL).pack(fill=tk.X,pady=8)
        tk.Label(form,text=labels.get('available_plans_section', "Available Plans"),font=("Helvetica",11,"bold"),bg=bg,fg=colors.get('text_primary','#333')).pack(anchor=tk.W,pady=(0,5))
        lf=tk.Frame(form,bg=bg); lf.pack(fill=tk.BOTH,expand=True,pady=(0,10))
        sb=tk.Scrollbar(lf); sb.pack(side=tk.RIGHT,fill=tk.Y)
        self.lb=tk.Listbox(lf,font=("Helvetica",10),yscrollcommand=sb.set,relief=tk.SOLID,bd=1)
        sb.config(command=self.lb.yview); self.lb.pack(fill=tk.BOTH,expand=True)

        ttk.Separator(form,orient=tk.HORIZONTAL).pack(fill=tk.X,pady=5)
        self.renew_btn=tk.Button(form,text=labels.get('renew_btn', "Renew License"),command=self._renew,
                                  font=("Helvetica",12,"bold"),bg=primary,fg="white",relief=tk.FLAT,padx=15,pady=8)
        self.renew_btn.pack(fill=tk.X,pady=(5,5))
        self.st=tk.Label(form,text="",font=("Helvetica",9),bg=bg,fg=colors.get('text_primary','#333'),wraplength=400); self.st.pack()
        self.root.bind('<Escape>',lambda e:self.root.destroy())
        self._load_plans()

    def _set_loading(self,v): self._loading=v; self.renew_btn.config(state='disabled' if v else 'normal')

    def _load_plans(self):
        colors = self.config.get('branding', {}).get('colors', {})
        self._set_loading(True); self.st.config(text="Loading plans...",fg=colors.get('text_muted','#888'))
        def do():
            try: self.root.after(0,lambda: self._on_plans(self.engine.get_plans()))
            except Exception as e: self.root.after(0,lambda: self.st.config(text=f"Error: {str(e)}",fg=colors.get('error','#dc2626')))
        threading.Thread(target=do,daemon=True).start()

    def _on_plans(self,r):
        colors = self.config.get('branding', {}).get('colors', {})
        self._set_loading(False)
        if r.get('success'):
            self.plans=r.get('data',r.get('plans',[])); self.lb.delete(0,tk.END)
            for i,p in enumerate(self.plans):
                self.lb.insert(tk.END,f"{p.get('name',f'Plan {i+1}')} - {p.get('price','--')} ({p.get('duration_days',p.get('default_expiry_days','--'))} days)")
            if self.plans: self.lb.selection_set(0)
            self.lb.bind('<<ListboxSelect>>',self._on_select)
        else: self.st.config(text=r.get('message','Failed'),fg=colors.get('error','#dc2626'))

    def _on_select(self,ev):
        sel=self.lb.curselection()
        if sel and sel[0]<len(self.plans): self.selected_plan=self.plans[sel[0]]
        else: self.selected_plan=None

    def _renew(self):
        colors = self.config.get('branding', {}).get('colors', {})
        if not self.selected_plan: self.st.config(text="Select a plan",fg=colors.get('error','#dc2626')); return
        self._set_loading(True); self.st.config(text="Processing...",fg=colors.get('text_primary','#333'))
        extra = self.selected_plan.get('duration_days') if isinstance(self.selected_plan, dict) else None
        def do():
            try:
                r=self.engine.renew(extra_days=extra)
                self.root.after(0,lambda: self._on_renew(r))
            except Exception as e: self.root.after(0,lambda: self.st.config(text=f"Error: {str(e)}",fg=colors.get('error','#dc2626')))
        threading.Thread(target=do,daemon=True).start()

    def _on_renew(self,r):
        colors = self.config.get('branding', {}).get('colors', {})
        self._set_loading(False)
        if r.get('success'):
            self.st.config(text="Renewed!",fg=colors.get('success','#16a34a')); self.result={'action':'renewed'}
            self.root.after(500,self.root.destroy)
        else: self.st.config(text=r.get('message','Failed'),fg=colors.get('error','#dc2626'))
`,
    'renew_license_dialog.py': `"""Renew License Dialog - generic renewal window with license verification"""
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Dict, Any, List


class RenewLicenseDialog:
    """Renewal dialog - scrollable, card-based layout.
    Verifies license via SDK, displays customer/license info, sends renewal request."""

    def __init__(self, engine, license_key: str = '', parent=None):
        self.engine = engine
        self.client = getattr(engine, '_client', None)
        self.config = getattr(engine, 'config', {})
        self._parent = parent
        self.license_key = license_key
        if license_key:
            self.engine._license_key = license_key
        self.result = None
        self.root = None
        self._verified = False
        self._license_data: Dict[str, Any] = {}
        self._plans: list = []
        self._selected_plan: Optional[Dict[str, Any]] = None

        branding = self.config.get('branding', {})
        self._colors = branding.get('colors', {})
        self._labels = branding.get('labels', {})
        self._primary = self._colors.get('primary', '#1e40af')
        self._bg = self._colors.get('bg_page', '#f8f9fa')
        self._card_bg = self._colors.get('bg_card', '#ffffff')
        self._text = self._colors.get('text_primary', '#333333')
        self._text_sec = self._colors.get('text_secondary', '#555555')
        self._muted = self._colors.get('text_muted', '#888888')
        self._border = self._colors.get('border', '#dbe3ef')
        self._success = self._colors.get('success', '#16a34a')
        self._error = self._colors.get('error', '#dc2626')
        self._support_email = branding.get('support_email', 'support@websmithdigital.com')

    def show(self) -> Optional[Dict[str, Any]]:
        if not self._parent:
            raise RuntimeError("SDK dialogs require the application root window as parent")
        self._build_ui()
        self._center()
        self.root.mainloop()
        return self.result

    def _build_ui(self):
        self.root = tk.Toplevel(self._parent)
        self.root.title(self._labels.get('renew_title', 'Renew License'))
        self.root.geometry('900x700')
        self.root.minsize(760, 600)
        self.root.resizable(True, True)
        self.root.configure(bg=self._bg)
        self.root.transient(self._parent)
        self.root.grab_set()
        self.root.protocol('WM_DELETE_WINDOW', self._on_close)

        canvas = tk.Canvas(self.root, bg=self._bg, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.root, orient=tk.VERTICAL, command=canvas.yview)
        scroll_frame = tk.Frame(canvas, bg=self._bg)
        scroll_frame.bind('<Configure>',
                          lambda e: canvas.configure(scrollregion=canvas.bbox('all')))
        self._canvas_win = canvas.create_window((0, 0), window=scroll_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_canvas_cfg(event):
            canvas.itemconfig(self._canvas_win, width=event.width - 4)
        canvas.bind('<Configure>', _on_canvas_cfg)

        content = tk.Frame(scroll_frame, bg=self._bg, padx=28, pady=24)
        content.pack(fill=tk.BOTH, expand=True)

        self._build_header(content)
        self._build_verification(content)
        self._build_customer_info(content)
        self._build_license_info(content)
        self._build_renewal_request(content)
        self._build_footer(content)

        if self.license_key:
            self._var_license_key.set(self.license_key)

    def _build_header(self, parent):
        card = self._card(parent)
        card.pack(fill=tk.X, pady=(0, 16))
        inner = tk.Frame(card, bg=self._card_bg, padx=24, pady=18)
        inner.pack(fill=tk.BOTH)
        tk.Label(inner, text='Renew License',
                 font=('Helvetica', 18, 'bold'),
                 bg=self._card_bg, fg=self._primary).pack(anchor=tk.W)
        tk.Label(inner,
                 text='Renew your subscription or request a new license from Websmith Digital.',
                 font=('Helvetica', 10),
                 bg=self._card_bg, fg=self._text_sec).pack(anchor=tk.W, pady=(4, 0))

    def _build_verification(self, parent):
        card = self._card(parent)
        card.pack(fill=tk.X, pady=(0, 16))
        inner = tk.Frame(card, bg=self._card_bg, padx=24, pady=16)
        inner.pack(fill=tk.BOTH)

        tk.Label(inner, text='License Verification',
                 font=('Helvetica', 12, 'bold'),
                 bg=self._card_bg, fg=self._text).pack(anchor=tk.W, pady=(0, 8))

        key_row = tk.Frame(inner, bg=self._card_bg)
        key_row.pack(fill=tk.X, pady=(0, 6))
        tk.Label(key_row, text='License Number',
                 font=('Helvetica', 10, 'bold'),
                 bg=self._card_bg, fg=self._text_sec).pack(anchor=tk.W, pady=(0, 4))

        input_row = tk.Frame(key_row, bg=self._card_bg)
        input_row.pack(fill=tk.X)
        self._var_license_key = tk.StringVar()
        self._entry_key = tk.Entry(
            input_row, textvariable=self._var_license_key,
            font=('Courier', 11),
            bg=self._card_bg, fg=self._text,
            insertbackground=self._primary,
            highlightbackground=self._border, highlightthickness=1,
            relief=tk.FLAT, bd=2)
        self._entry_key.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=6, padx=(0, 8))

        self._btn_verify = tk.Button(
            input_row, text='Verify', command=self._on_verify,
            font=('Helvetica', 10, 'bold'),
            fg='white', bg=self._primary,
            activebackground=self._primary, activeforeground='white',
            bd=0, padx=20, pady=6, cursor='hand2')
        self._btn_verify.pack(side=tk.RIGHT)

        self._var_status = tk.StringVar(value='Not Verified')
        self._status_label = tk.Label(
            inner, textvariable=self._var_status,
            font=('Helvetica', 10),
            bg=self._card_bg, fg=self._muted)
        self._status_label.pack(anchor=tk.W, pady=(4, 0))

    def _build_customer_info(self, parent):
        card = self._card(parent)
        card.pack(fill=tk.X, pady=(0, 16))
        inner = tk.Frame(card, bg=self._card_bg, padx=24, pady=16)
        inner.pack(fill=tk.BOTH)

        tk.Label(inner, text='Customer Information',
                 font=('Helvetica', 12, 'bold'),
                 bg=self._card_bg, fg=self._text).pack(anchor=tk.W, pady=(0, 10))

        self._var_cust_name = tk.StringVar()
        self._var_email = tk.StringVar()
        self._var_mobile = tk.StringVar()

        for lbl, var in [('Customer Name', self._var_cust_name),
                         ('Email Address', self._var_email),
                         ('Mobile Number', self._var_mobile)]:
            row = tk.Frame(inner, bg=self._card_bg)
            row.pack(fill=tk.X, pady=(0, 8))
            tk.Label(row, text=lbl, font=('Helvetica', 10, 'bold'),
                     bg=self._card_bg, fg=self._text_sec).pack(anchor=tk.W, pady=(0, 3))
            entry = tk.Entry(row, textvariable=var, font=('Helvetica', 11),
                             bg=self._card_bg, fg=self._text,
                             insertbackground=self._primary,
                             highlightbackground=self._border, highlightthickness=1,
                             relief=tk.FLAT, bd=2)
            entry.pack(fill=tk.X, ipady=6)

    def _build_license_info(self, parent):
        card = self._card(parent)
        card.pack(fill=tk.X, pady=(0, 16))
        inner = tk.Frame(card, bg=self._card_bg, padx=24, pady=16)
        inner.pack(fill=tk.BOTH)

        tk.Label(inner, text='License Information',
                 font=('Helvetica', 12, 'bold'),
                 bg=self._card_bg, fg=self._text).pack(anchor=tk.W, pady=(0, 10))

        self._var_plan = tk.StringVar(value='--')
        self._var_lic_status = tk.StringVar(value='--')
        self._var_expiry = tk.StringVar(value='--')

        for lbl, var in [('Current Plan', self._var_plan),
                         ('Status', self._var_lic_status),
                         ('Expiry Date', self._var_expiry)]:
            row = tk.Frame(inner, bg=self._card_bg)
            row.pack(fill=tk.X, pady=(0, 6))
            tk.Label(row, text=lbl + ':', font=('Helvetica', 10, 'bold'),
                     bg=self._card_bg, fg=self._text_sec,
                     width=18, anchor=tk.W).pack(side=tk.LEFT)
            tk.Label(row, textvariable=var, font=('Helvetica', 11, 'bold'),
                     bg=self._card_bg, fg=self._text).pack(side=tk.LEFT, fill=tk.X, expand=True)

    def _build_renewal_request(self, parent):
        card = self._card(parent)
        card.pack(fill=tk.X, pady=(0, 16))
        inner = tk.Frame(card, bg=self._card_bg, padx=24, pady=16)
        inner.pack(fill=tk.BOTH)

        tk.Label(inner, text='Renewal Request',
                 font=('Helvetica', 12, 'bold'),
                 bg=self._card_bg, fg=self._text).pack(anchor=tk.W, pady=(0, 10))

        row = tk.Frame(inner, bg=self._card_bg)
        row.pack(fill=tk.X, pady=(0, 6))
        tk.Label(row, text='To:', font=('Helvetica', 10, 'bold'),
                 bg=self._card_bg, fg=self._text_sec, width=14, anchor=tk.W).pack(side=tk.LEFT)
        tk.Label(row, text=self._support_email,
                 font=('Helvetica', 11, 'bold'),
                 bg=self._card_bg, fg=self._primary).pack(side=tk.LEFT)

        row = tk.Frame(inner, bg=self._card_bg)
        row.pack(fill=tk.X, pady=(0, 6))
        tk.Label(row, text='Subject:', font=('Helvetica', 10, 'bold'),
                 bg=self._card_bg, fg=self._text_sec, width=14, anchor=tk.W).pack(side=tk.LEFT)
        self._var_subject = tk.StringVar(value='License Renewal Request')
        tk.Label(row, textvariable=self._var_subject,
                 font=('Helvetica', 11),
                 bg=self._card_bg, fg=self._text).pack(side=tk.LEFT)

        tk.Label(inner, text='Request Type',
                 font=('Helvetica', 10, 'bold'),
                 bg=self._card_bg, fg=self._text_sec).pack(anchor=tk.W, pady=(6, 4))
        self._var_req_type = tk.StringVar(value='renew')
        radio_frame = tk.Frame(inner, bg=self._card_bg)
        radio_frame.pack(fill=tk.X, pady=(0, 6))
        for val, txt in [('renew', 'Renew Existing License'),
                         ('new', 'Request New License')]:
            tk.Radiobutton(radio_frame, text=txt, variable=self._var_req_type, value=val,
                           font=('Helvetica', 10),
                           bg=self._card_bg, fg=self._text,
                           selectcolor=self._card_bg,
                           activebackground=self._card_bg,
                           indicatoron=True).pack(side=tk.LEFT, padx=(0, 20))

        tk.Label(inner, text='Select Plan',
                 font=('Helvetica', 10, 'bold'),
                 bg=self._card_bg, fg=self._text_sec).pack(anchor=tk.W, pady=(6, 4))
        plan_frame = tk.Frame(inner, bg=self._card_bg)
        plan_frame.pack(fill=tk.X, pady=(0, 6))
        self._var_plan_name = tk.StringVar(value='No plans available')
        self._plan_dropdown = ttk.Combobox(
            plan_frame, textvariable=self._var_plan_name,
            font=('Helvetica', 11), state='disabled')
        self._plan_dropdown.pack(fill=tk.X, ipady=4)
        self._plan_dropdown.bind('<<ComboboxSelected>>', self._on_plan_selected)

        tk.Label(inner, text='Message',
                 font=('Helvetica', 10, 'bold'),
                 bg=self._card_bg, fg=self._text_sec).pack(anchor=tk.W, pady=(6, 4))
        self._msg_text = tk.Text(inner, font=('Helvetica', 10),
                                 bg=self._card_bg, fg=self._text,
                                 insertbackground=self._primary,
                                 highlightbackground=self._border,
                                 highlightthickness=1,
                                 relief=tk.FLAT, bd=2,
                                 height=5, wrap=tk.WORD)
        self._msg_text.pack(fill=tk.X)
        self._msg_text.insert(tk.END, 'Additional details...')

    def _build_footer(self, parent):
        footer = tk.Frame(parent, bg=self._bg)
        footer.pack(fill=tk.X, pady=(8, 0))

        sep = tk.Frame(footer, bg=self._border, height=1)
        sep.pack(fill=tk.X, pady=(0, 10))

        btn_frame = tk.Frame(footer, bg=self._bg)
        btn_frame.pack(fill=tk.X)

        self._btn_cancel = tk.Button(
            btn_frame, text='Cancel', command=self._on_close,
            font=('Helvetica', 10),
            fg=self._text, bg=self._colors.get('bg_button', '#e5e7eb'),
            activebackground=self._colors.get('bg_button', '#e5e7eb'),
            bd=0, padx=16, pady=6, cursor='hand2')
        self._btn_cancel.pack(side=tk.LEFT, padx=(0, 8))

        self._btn_reset = tk.Button(
            btn_frame, text='Reset', command=self._on_reset,
            font=('Helvetica', 10),
            fg=self._text, bg=self._colors.get('bg_button', '#e5e7eb'),
            activebackground=self._colors.get('bg_button', '#e5e7eb'),
            bd=0, padx=16, pady=6, cursor='hand2')
        self._btn_reset.pack(side=tk.LEFT, padx=(0, 8))

        self._btn_send = tk.Button(
            btn_frame, text='Send Request', command=self._on_send,
            font=('Helvetica', 10, 'bold'),
            fg='white', bg=self._primary,
            activebackground=self._primary, activeforeground='white',
            bd=0, padx=20, pady=6, cursor='hand2')
        self._btn_send.pack(side=tk.RIGHT)

    def _card(self, parent) -> tk.Frame:
        return tk.Frame(parent, bg=self._card_bg,
                        highlightbackground=self._border,
                        highlightthickness=1, bd=0)

    def _center(self):
        if not self.root:
            return
        self.root.update_idletasks()
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f'{w}x{h}+{x}+{y}')

    def _on_close(self):
        if self.root:
            self.root.destroy()
            self.root = None

    def _on_verify(self):
        key = self._var_license_key.get().strip()
        if not key:
            messagebox.showwarning('Input Required', 'Enter a license key.',
                                   parent=self.root)
            return

        self._btn_verify.config(state=tk.DISABLED, text='Verifying...')
        self._var_status.set('Verifying...')
        self._status_label.config(fg=self._muted)
        self.root.update_idletasks()

        import threading

        def _do_verify():
            try:
                client = self.client
                if client is None:
                    raise RuntimeError('SDK client not available')

                verify_resp = client.verify_license_for_renewal(key)
                if not verify_resp.get('valid'):
                    msg = verify_resp.get('message', 'Invalid license')
                    self.root.after(0, lambda: self._verify_failed(msg))
                    return

                details_resp = client.get_license_details(key)
                data = {**verify_resp, **details_resp}
                self.root.after(0, lambda: self._verify_success(data))

            except Exception as exc:
                self.root.after(0, lambda e=exc: self._verify_failed(str(e)))

        threading.Thread(target=_do_verify, daemon=True).start()

    def _load_plans(self):
        plans = self._license_data.get('available_plans', [])
        if plans:
            self._plans = plans
            plan_names = [p.get('name', f'Plan {i+1}') for i, p in enumerate(plans)]
            self._plan_dropdown['values'] = plan_names
            self._plan_dropdown['state'] = 'readonly'
            self._var_plan_name.set('')
            self._selected_plan = None
        else:
            self._plans = []
            self._plan_dropdown['values'] = []
            self._plan_dropdown['state'] = 'disabled'
            self._var_plan_name.set('No plans available')
            self._selected_plan = None

    def _on_plan_selected(self, event=None):
        sel = self._var_plan_name.get()
        for p in self._plans:
            if p.get('name') == sel:
                self._selected_plan = p
                return
        self._selected_plan = None

    def _verify_success(self, data: Dict[str, Any]):
        self._verified = True
        self._license_data = data

        self._var_status.set('\\u2713 Verified')
        self._status_label.config(fg=self._success)
        self._btn_verify.config(state=tk.NORMAL, text='Verify')

        self._var_cust_name.set(data.get('customer_name', ''))
        self._var_email.set(data.get('email', data.get('customer_email', '')))
        self._var_mobile.set(data.get('mobile', data.get('customer_mobile', '')))

        self._var_plan.set(data.get('plan', '--'))
        status_text = data.get('status', '--')
        if isinstance(status_text, str):
            status_text = status_text.upper()
        self._var_lic_status.set(status_text)
        expiry = data.get('expiry_date', '--')
        if expiry and expiry != '--':
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
                expiry = dt.strftime('%d %b %Y')
            except Exception:
                pass
        self._var_expiry.set(expiry)

        self._load_plans()

    def _verify_failed(self, msg: str):
        self._verified = False
        self._license_data = {}
        self._plans = []
        self._selected_plan = None
        self._plan_dropdown['state'] = 'disabled'
        self._plan_dropdown['values'] = []
        self._var_plan_name.set('No plans available')
        self._var_status.set(f'\\u2717 {msg}')
        self._status_label.config(fg=self._error)
        self._btn_verify.config(state=tk.NORMAL, text='Verify')

    def _on_reset(self):
        self._var_license_key.set('')
        self._var_cust_name.set('')
        self._var_email.set('')
        self._var_mobile.set('')
        self._var_plan.set('--')
        self._var_lic_status.set('--')
        self._var_expiry.set('--')
        self._var_subject.set('License Renewal Request')
        self._var_req_type.set('renew')
        self._msg_text.delete('1.0', tk.END)
        self._msg_text.insert(tk.END, 'Additional details...')
        self._verified = False
        self._license_data = {}
        self._plans = []
        self._selected_plan = None
        self._plan_dropdown['state'] = 'disabled'
        self._plan_dropdown['values'] = []
        self._var_plan_name.set('No plans available')
        self._var_status.set('Not Verified')
        self._status_label.config(fg=self._muted)

    def _on_send(self):
        if not self._verified:
            messagebox.showwarning('Not Verified',
                                   'Verify your license first.',
                                   parent=self.root)
            return

        key = self._var_license_key.get().strip()
        cust_name = self._var_cust_name.get().strip()
        email = self._var_email.get().strip()
        mobile = self._var_mobile.get().strip()
        subject = self._var_subject.get().strip()
        msg = self._msg_text.get('1.0', tk.END).strip()
        req_type = self._var_req_type.get()

        if not msg or msg == 'Additional details...':
            msg = ''

        if not key:
            messagebox.showwarning('Input Required', 'License key is missing.',
                                   parent=self.root)
            return

        self._btn_send.config(state=tk.DISABLED, text='Sending...')
        self.root.update_idletasks()

        import threading

        plan_id = ''
        plan_name = ''
        if self._selected_plan:
            plan_id = str(self._selected_plan.get('id', ''))
            plan_name = self._selected_plan.get('name', '')

        def _do_send():
            try:
                client = self.client
                if client is None:
                    raise RuntimeError('SDK client not available')

                resp = client.send_renewal_request(
                    license_key=key,
                    customer_name=cust_name,
                    email=email,
                    mobile=mobile,
                    subject=subject,
                    message=msg,
                    request_type=req_type,
                    selected_plan_id=plan_id,
                    selected_plan_name=plan_name,
                )
                self.root.after(0, lambda: self._send_done(resp))

            except Exception as exc:
                self.root.after(0, lambda e=exc: self._send_error(str(e)))

        threading.Thread(target=_do_send, daemon=True).start()

    def _send_done(self, resp: Dict[str, Any]):
        self._btn_send.config(state=tk.NORMAL, text='Send Request')
        if resp.get('success'):
            messagebox.showinfo('Sent',
                                'Your renewal request has been sent to Websmith Digital.\\n'
                                'You will receive a response shortly.',
                                parent=self.root)
            self.result = resp
            self._on_close()
        else:
            msg = resp.get('message', resp.get('error', 'Failed to send request.'))
            messagebox.showerror('Error', msg, parent=self.root)

    def _send_error(self, msg: str):
        self._btn_send.config(state=tk.NORMAL, text='Send Request')
        messagebox.showerror('Error', f'Failed to send request:\\n{msg}',
                             parent=self.root)
`,
    'device_replace.py': `"""Device Replacement Dialog for ${context.productName}"""
import threading
import tkinter as tk
from tkinter import ttk
from typing import Optional, Dict, Any


class DeviceReplaceDialog:
    def __init__(self, engine, license_key: str, parent=None):
        self.engine=engine; self.config=getattr(engine,'config',{})
        self._parent=parent
        self.license_key=license_key; self.engine._license_key=license_key
        self.result=None; self.root=None; self._loading=False

    def show(self)->Optional[Dict[str,Any]]:
        self._build_ui(); self.root.mainloop(); return self.result

    def _build_ui(self):
        branding=self.config.get('branding',{}); colors = branding.get('colors', {})
        primary=colors.get('primary', branding.get('primary_color','#6366f1')); bg=colors.get('bg_page','#f8f9fa')
        labels=branding.get('labels',{})
        unknown_lbl = labels.get('unknown_device', 'Unknown')
        s=self.engine.get_status()
        old_hw_str = s.hardware_id if s and s.hardware_id else unknown_lbl
        if s is None or not s.hardware_id:
            c=getattr(self.engine,'_cache',None)
            if c:
                cached = c.get_license_status()
                if cached: old_hw_str=cached.get('hardware_id', unknown_lbl)
        new_hw=self.engine.get_hardware_id()
        if not self._parent:
            raise RuntimeError("SDK dialogs require the application root window as parent")
        self.root = tk.Toplevel(self._parent)
        self.root.transient(self._parent)
        self.root.grab_set()
        self.root.title(labels.get('replace_title', "Replace Device")); self.root.geometry("450x430")
        self.root.resizable(False,False); self.root.configure(bg=bg)
        self.root.update_idletasks()
        sw=self.root.winfo_screenwidth(); sh=self.root.winfo_screenheight(); w=self.root.winfo_width(); h=self.root.winfo_height()
        self.root.geometry(f"+{(sw-w)//2}+{(sh-h)//2}")
        header=tk.Frame(self.root,bg=primary,height=60); header.pack(fill=tk.X); header.pack_propagate(False)
        tk.Label(header,text=labels.get('replace_title', "Replace Device"),fg="white",bg=primary,font=("Helvetica",16,"bold")).pack(expand=True)
        form=tk.Frame(self.root,bg=bg,padx=25,pady=15); form.pack(fill=tk.BOTH,expand=True)
        tk.Label(form,text=labels.get('device_replace_section', "Device Replacement"),font=("Helvetica",12,"bold"),bg=bg,fg=colors.get('text_primary','#333')).pack(anchor=tk.W,pady=(0,10))
        tk.Label(form,text=labels.get('device_replace_desc', "Move your license from old device to this one."),
                 font=("Helvetica",10),bg=bg,fg=colors.get('text_secondary','#555'),wraplength=380).pack(anchor=tk.W,pady=(0,12))
        hwf=tk.Frame(form,bg=bg); hwf.pack(fill=tk.X,pady=(0,10))
        tk.Label(hwf,text=labels.get('old_hardware_label', "Old Hardware")+":",font=("Helvetica",10,"bold"),bg=bg,fg=colors.get('text_secondary','#555')).pack(anchor=tk.W)
        tk.Label(hwf,text=old_hw_str[:48]+("..." if len(old_hw_str)>48 else ""),
                 font=("Courier",9),bg=bg,fg=colors.get('text_muted','#888'),wraplength=380,anchor=tk.W).pack(fill=tk.X,pady=(0,8))
        tk.Label(hwf,text=labels.get('new_hardware_label', "New Hardware")+":",font=("Helvetica",10,"bold"),bg=bg,fg=colors.get('text_secondary','#555')).pack(anchor=tk.W)
        tk.Label(hwf,text=new_hw[:48]+("..." if len(new_hw)>48 else ""),
                 font=("Courier",9),bg=bg,fg=colors.get('text_primary','#333'),wraplength=380,anchor=tk.W).pack(fill=tk.X,pady=(0,10))
        tk.Label(hwf,text=labels.get('device_name_label', "Device Name")+":",font=("Helvetica",10,"bold"),bg=bg,fg=colors.get('text_secondary','#555')).pack(anchor=tk.W)
        self.dev_name=tk.Entry(hwf,font=("Helvetica",10),relief=tk.SOLID,bd=1)
        self.dev_name.pack(fill=tk.X,ipady=3)
        import platform; self.dev_name.insert(0,platform.node() or labels.get('new_device', 'New Device'))
        ttk.Separator(form,orient=tk.HORIZONTAL).pack(fill=tk.X,pady=8)
        self.repl_btn=tk.Button(form,text=labels.get('replace_btn', "Replace Device"),command=self._replace,
                                 font=("Helvetica",12,"bold"),bg=primary,fg="white",relief=tk.FLAT,padx=15,pady=8)
        self.repl_btn.pack(fill=tk.X,pady=(5,5))
        btn_bg = colors.get('bg_button', '#e5e7eb'); btn_fg = colors.get('text_primary', '#333')
        self.cancel_btn=tk.Button(form,text=labels.get('cancel_btn', "Cancel"),command=self.root.destroy,
                                   font=("Helvetica",10),bg=btn_bg,fg=btn_fg,relief=tk.FLAT,padx=10,pady=5)
        self.cancel_btn.pack()
        self.st=tk.Label(form,text="",font=("Helvetica",9),bg=bg,fg=colors.get('text_primary','#333'),wraplength=380); self.st.pack(pady=(5,0))
        self.root.bind('<Escape>',lambda e:self.root.destroy())

    def _set_loading(self,v): self._loading=v; self.repl_btn.config(state='disabled' if v else 'normal')

    def _replace(self):
        colors = self.config.get('branding', {}).get('colors', {})
        self._set_loading(True); self.st.config(text="Replacing device...",fg=colors.get('text_primary','#333'))
        def do():
            try:
                r=self.engine.replace_hardware(device_name=self.dev_name.get().strip() or None)
                self.root.after(0,lambda: self._on_result(r))
            except Exception as e: self.root.after(0,lambda: self.st.config(text=f"Error: {str(e)}",fg=colors.get('error','#dc2626')))
        threading.Thread(target=do,daemon=True).start()

    def _on_result(self,r):
        colors = self.config.get('branding', {}).get('colors', {})
        self._set_loading(False)
        if r.get('success'):
            self.st.config(text="Device replaced!",fg=colors.get('success','#16a34a')); self.result={'action':'device_replaced'}
            self.root.after(500,self.root.destroy)
        else: self.st.config(text=r.get('message','Failed'),fg=colors.get('error','#dc2626'))
`,
    'widgets/__init__.py': `from .dashboard_widget import DashboardWidget
from .settings_widget import SettingsWidget
from .status_widget import StatusWidget
from .activation_button import ActivationButton
from .about import AboutWidget, AboutDialog

__all__ = ['DashboardWidget', 'SettingsWidget', 'StatusWidget', 'ActivationButton', 'AboutWidget', 'AboutDialog']
`,
    'widgets/dashboard_widget.py': `"""Dashboard Widget for ${context.productName}"""
import tkinter as tk
from tkinter import ttk


class DashboardWidget:
    def __init__(self, parent, engine):
        self.parent=parent; self.engine=engine
        self.frame=ttk.Frame(parent)
        self._w={}
    def build(self)->ttk.Frame:
        self.frame.pack(fill=tk.BOTH,expand=True)
        branding=self.engine.config.get('branding',{}); labels=branding.get('labels',{}); colors=branding.get('colors',{})
        bg=colors.get('bg_page','#f8f9fa'); tx_p=colors.get('text_primary','#333'); tx_s=colors.get('text_secondary','#555')
        btn_bg=colors.get('bg_button','#e5e7eb')
        tk.Label(self.frame,text=labels.get('license_status_section', "License Status"),font=("Helvetica",14,"bold"),fg=tx_p).pack(pady=(10,5))
        inf=tk.Frame(self.frame,bg=bg,padx=15,pady=10); inf.pack(fill=tk.X,padx=10)
        status_lbl = labels.get('status_label', 'Status')
        self._w['s']=tk.Label(inf,text=f"{status_lbl}: {labels.get('checking_status', 'Checking...')}",font=("Helvetica",11),bg=bg,fg=tx_p)
        self._w['s'].pack(anchor=tk.W,pady=2)
        self._w['t']=tk.Label(inf,text="",font=("Helvetica",11),bg=bg,fg=tx_s); self._w['t'].pack(anchor=tk.W,pady=2)
        self._w['d']=tk.Label(inf,text="",font=("Helvetica",11),bg=bg,fg=tx_s); self._w['d'].pack(anchor=tk.W,pady=2)
        self._w['e']=tk.Label(inf,text="",font=("Helvetica",11),bg=bg,fg=tx_s); self._w['e'].pack(anchor=tk.W,pady=2)
        self._w['p']=tk.Label(inf,text="",font=("Helvetica",11),bg=bg,fg=tx_s); self._w['p'].pack(anchor=tk.W,pady=2)
        tk.Button(self.frame,text=labels.get('refresh_btn',"Refresh"),command=self.refresh,font=("Helvetica",9),bg=btn_bg,fg=tx_p,relief=tk.FLAT,padx=10,pady=3).pack(pady=(8,5))
        self.refresh(); return self.frame
    def refresh(self):
        branding=self.engine.config.get('branding',{}); labels=branding.get('labels',{}); colors=branding.get('colors',{})
        s=self.engine.get_status() or self.engine.initialize()
        status_lbl = labels.get('status_label', 'Status')
        days_lbl = labels.get('remaining_days_label', 'Remaining days')
        expiry_lbl = labels.get('expiry_label', 'Expiry')
        plan_lbl = labels.get('plan_label', 'Plan')
        if s and s.valid:
            c=colors.get('success','#16a34a'); label=labels.get('trial_active_text','Trial Active') if s.trial_active else labels.get('licensed_text','Licensed')
            self._w['s'].config(text=f"{status_lbl}: {label}",fg=c)
            self._w['t'].config(text=label)
            self._w['d'].config(text=f"{days_lbl}: {s.days_left}")
            self._w['e'].config(text=f"{expiry_lbl}: {s.expiry_date or labels.get('expiry_na', 'N/A')}")
            self._w['p'].config(text=f"{plan_lbl}: {s.plan or labels.get('plan_na', 'N/A')}")
        else:
            self._w['s'].config(text=f"{status_lbl}: {labels.get('unlicensed_status', 'Unlicensed')}",fg=colors.get('error','#dc2626')); self._w['t'].config(text=labels.get('no_active_text', 'No active license or trial'))
            for k in ['d','e','p']: self._w[k].config(text="")
`,
    'widgets/activation_button.py': `"""Activation Button for ${context.productName}"""
import tkinter as tk


class ActivationButton:
    def __init__(self, parent, engine):
        self.parent=parent; self.engine=engine; self.btn=None
    def build(self)->tk.Button:
        branding=self.engine.config.get('branding',{}); labels=branding.get('labels',{}); colors=branding.get('colors',{})
        primary=colors.get('primary','#6366f1')
        self.btn=tk.Button(self.parent,text=labels.get('activate_license_btn',"Activate License"),command=self._click,
                            font=("Helvetica",10,"bold"),bg=primary,fg="white",relief=tk.FLAT,padx=15,pady=6,cursor="hand2")
        self.btn.pack(); return self.btn
    def _click(self):
        colors=self.engine.config.get('branding',{}).get('colors',{})
        labels=self.engine.config.get('branding',{}).get('labels',{})
        from ..activation import ActivationDialog
        r=ActivationDialog(
            getattr(self.engine, '_client', None),
            product_name=self.engine.config.get('product', {}).get('name', ''),
            cache=getattr(self.engine, '_cache', None)
        ).show()
        if r and r.get('activated') and self.btn:
            self.btn.config(text=labels.get('licensed_text',"Licensed"),bg=colors.get('success','#16a34a'))
`,
    'widgets/settings_widget.py': `"""Settings Widget for ${context.productName}"""
import tkinter as tk
from tkinter import ttk


class SettingsWidget:
    def __init__(self, parent, engine):
        self.parent=parent; self.engine=engine; self.frame=ttk.Frame(parent); self._w={}
    def build(self)->ttk.Frame:
        self.frame.pack(fill=tk.BOTH,expand=True)
        nb=ttk.Notebook(self.frame); nb.pack(fill=tk.BOTH,expand=True,padx=10,pady=10)
        tab=ttk.Frame(nb); nb.add(tab,text="License"); self._build_tab(tab); return self.frame
    def _build_tab(self,parent):
        branding=self.engine.config.get('branding',{}); labels=branding.get('labels',{}); colors=branding.get('colors',{})
        bg=colors.get('bg_page','#f8f9fa'); tx_p=colors.get('text_primary','#333'); tx_s=colors.get('text_secondary','#555'); tx_m=colors.get('text_muted','#888')
        cv=tk.Frame(parent,bg=bg,padx=20,pady=15); cv.pack(fill=tk.BOTH,expand=True)
        tk.Label(cv,text=labels.get('license_info_section',"License Information"),font=("Helvetica",13,"bold"),bg=bg,fg=tx_p).pack(anchor=tk.W,pady=(0,12))
        status_lbl=labels.get('status_label','Status'); prod_lbl=labels.get('product_label','Product')
        expiry_lbl=labels.get('expiry_label','Expiry'); plan_lbl=labels.get('plan_label','Plan')
        hw_lbl=labels.get('hardware_id_label','Hardware ID'); runtime_lbl=labels.get('runtime_label','Runtime')
        sdk_lbl=labels.get('sdk_version_label','SDK Version'); ph=labels.get('hardware_placeholder','--')
        self._w['s']=tk.Label(cv,text=f"{status_lbl}: {ph}",font=("Helvetica",10),bg=bg,fg=tx_s); self._w['s'].pack(anchor=tk.W,pady=2)
        self._w['p']=tk.Label(cv,text=f"{prod_lbl}: {ph}",font=("Helvetica",10),bg=bg,fg=tx_s); self._w['p'].pack(anchor=tk.W,pady=2)
        self._w['e']=tk.Label(cv,text=f"{expiry_lbl}: {ph}",font=("Helvetica",10),bg=bg,fg=tx_s); self._w['e'].pack(anchor=tk.W,pady=2)
        self._w['pl']=tk.Label(cv,text=f"{plan_lbl}: {ph}",font=("Helvetica",10),bg=bg,fg=tx_s); self._w['pl'].pack(anchor=tk.W,pady=2)
        self._w['h']=tk.Label(cv,text=f"{hw_lbl}: {ph}",font=("Courier",9),bg=bg,fg=tx_m); self._w['h'].pack(anchor=tk.W,pady=2)
        runtime_val=labels.get('runtime_value','Python')
        self._w['r']=tk.Label(cv,text=f"{runtime_lbl}: {runtime_val}",font=("Helvetica",10),bg=bg,fg=tx_s); self._w['r'].pack(anchor=tk.W,pady=2)
        ver=self.engine.config.get('product',{}).get('version','')
        self._w['sdk']=tk.Label(cv,text=f"{sdk_lbl}: {ver}",font=("Helvetica",10),bg=bg,fg=tx_s); self._w['sdk'].pack(anchor=tk.W,pady=2)
        ttk.Separator(cv,orient=tk.HORIZONTAL).pack(fill=tk.X,pady=12)
        bf=tk.Frame(cv,bg=bg); bf.pack(fill=tk.X)
        for cmd,clr,txt in [(self._open_activation,colors.get('primary','#6366f1'),labels.get('activate_btn',"Activate")),
                            (self._open_renewal,colors.get('info','#10b981'),labels.get('renew_btn',"Renew")),
                            (self._open_replace,colors.get('warning','#f59e0b'),labels.get('replace_btn',"Replace Device")),
                            (self.refresh,colors.get('gray','#6b7280'),labels.get('refresh_btn',"Refresh")),
                            (self._open_welcome,colors.get('accent','#8b5cf6'),labels.get('open_welcome_btn',"Open Welcome"))]:
            tk.Button(bf,text=txt,command=cmd,font=("Helvetica",10),bg=clr,fg="white",relief=tk.FLAT,padx=12,pady=5).pack(fill=tk.X,pady=3)
        self.refresh()
    def refresh(self):
        branding=self.engine.config.get('branding',{}); labels=branding.get('labels',{}); colors=branding.get('colors',{})
        s=self.engine.get_status() or self.engine.initialize()
        status_lbl=labels.get('status_label','Status'); prod_lbl=labels.get('product_label','Product')
        expiry_lbl=labels.get('expiry_label','Expiry'); plan_lbl=labels.get('plan_label','Plan')
        hw_lbl=labels.get('hardware_id_label','Hardware ID')
        if s:
            self._w['s'].config(text=f"{status_lbl}: {s.status.upper()}",fg=colors.get('success','#16a34a') if s.valid else colors.get('error','#dc2626'))
            n=self.engine.config.get('product',{}).get('name','')
            self._w['p'].config(text=f"{prod_lbl}: {n}"); self._w['e'].config(text=f"{expiry_lbl}: {s.expiry_date or labels.get('expiry_na', 'N/A')}")
            self._w['pl'].config(text=f"{plan_lbl}: {s.plan or labels.get('plan_na', 'N/A')}"); self._w['h'].config(text=f"{hw_lbl}: {s.hardware_id or labels.get('hardware_placeholder', '--')}")
    def _open_activation(self):
        from ..activation import ActivationDialog
        ActivationDialog(
            getattr(self.engine, '_client', None),
            product_name=self.engine.config.get('product', {}).get('name', ''),
            cache=getattr(self.engine, '_cache', None)
        ).show(); self.refresh()
    def _open_renewal(self):
        from ..renewal import RenewalDialog
        k=self.engine.get_license_key()
        if k: RenewalDialog(self.engine,k, parent=self.parent).show(); self.refresh()
    def _open_replace(self):
        from ..device_replace import DeviceReplaceDialog
        k=self.engine.get_license_key()
        if k: DeviceReplaceDialog(self.engine,k, parent=self.parent).show(); self.refresh()
    def _open_welcome(self):
        from ..welcome import WelcomeDialog
        WelcomeDialog(
            getattr(self.engine, '_client', None),
            product_name=self.engine.config.get('product', {}).get('name', ''),
            cache=getattr(self.engine, '_cache', None)
        ).show(); self.refresh()
`,
    'widgets/status_widget.py': `"""Status Widget for ${context.productName}"""
import tkinter as tk
from tkinter import ttk


class StatusWidget:
    def __init__(self, parent, engine):
        self.parent=parent; self.engine=engine; self.frame=ttk.Frame(parent)
    def build(self)->ttk.Frame:
        self.frame.pack(fill=tk.X,padx=5,pady=2)
        branding=self.engine.config.get('branding',{}); colors=branding.get('colors',{}); labels=branding.get('labels',{})
        bg=colors.get('bg_page','#f8f9fa'); tx_m=colors.get('text_muted','#888'); tx_s=colors.get('text_secondary','#555')
        inner=tk.Frame(self.frame,bg=bg,padx=8,pady=4); inner.pack(fill=tk.X)
        self.icon=tk.Label(inner,text="\\u25cf",font=("Helvetica",14),bg=bg,fg=tx_m)
        self.icon.pack(side=tk.LEFT,padx=(0,5))
        self.label=tk.Label(inner,text=labels.get('checking_status',"Checking..."),font=("Helvetica",10),bg=bg,fg=tx_s)
        self.label.pack(side=tk.LEFT)
        self.refresh(); return self.frame
    def refresh(self):
        branding=self.engine.config.get('branding',{}); colors=branding.get('colors',{}); labels=branding.get('labels',{})
        s=self.engine.get_status() or self.engine.initialize()
        if s and s.valid:
            t=f"{labels.get('trial_active_text','Trial')}: {s.days_left}d" if s.trial_active else f"{labels.get('licensed_text','Licensed')}: {s.days_left}d"
            c=colors.get('warning','#f59e0b') if s.trial_active else colors.get('success','#16a34a')
            self.label.config(text=t,fg=c); self.icon.config(fg=c)
        else:
            self.label.config(text=s.message if s else labels.get('no_license_text',"No license"),fg=colors.get('error','#dc2626'))
            self.icon.config(fg=colors.get('error','#dc2626'))
`,
    'widgets/about.py': `"""About Widget for ${context.productName} - Sidebar footer and Settings → About dialog"""
import tkinter as tk
from tkinter import ttk
from datetime import datetime
from typing import Any, Dict, Optional


class AboutWidget:
    """Sidebar footer widget showing 'Powered by Websmith Digital™'"""

    def __init__(self, parent, engine):
        self.parent = parent
        self.engine = engine
        self.frame = tk.Frame(parent)
        self._build()

    def _build(self):
        branding = self.engine.config.get('branding', {})
        colors = branding.get('colors', {})
        labels = branding.get('labels', {})

        bg = colors.get('bg_page', '#f8f9fa')
        text_muted = colors.get('text_muted', '#888888')
        border = colors.get('border', '#dbe3ef')

        self.frame.configure(bg=bg)
        self.frame.pack(fill=tk.X, side=tk.BOTTOM, padx=8, pady=(0, 6))

        sep = tk.Frame(self.frame, bg=border, height=1)
        sep.pack(fill=tk.X, pady=(0, 4))

        footer_frame = tk.Frame(self.frame, bg=bg)
        footer_frame.pack(fill=tk.X)

        company = branding.get('company_name', 'Websmith Digital™')
        tk.Label(
            footer_frame,
            text=f"Powered by {company}",
            font=("Segoe UI", 7, "bold"),
            bg=bg,
            fg=text_muted
        ).pack(anchor=tk.CENTER)

        tk.Label(
            footer_frame,
            text=labels.get('about_subtitle', 'Universal License Platform'),
            font=("Segoe UI", 6),
            bg=bg,
            fg=text_muted
        ).pack(anchor=tk.CENTER)

        location = branding.get('location', 'Kolkata, West Bengal, India')
        tk.Label(
            footer_frame,
            text=location,
            font=("Segoe UI", 6),
            bg=bg,
            fg=text_muted
        ).pack(anchor=tk.CENTER, pady=(0, 2))

        return self.frame


class AboutDialog:
    """Settings → About dialog with dynamic product/runtime/license info"""

    def __init__(self, parent, engine):
        self.parent = parent
        self.engine = engine
        self.config = engine.config
        self.branding = self.config.get('branding', {})
        self.colors = self.branding.get('colors', {})
        self.labels = self.branding.get('labels', {})
        self._root: Optional[tk.Toplevel] = None

    def show(self):
        if self._root and self._root.winfo_exists():
            self._root.lift()
            return

        self._root = tk.Toplevel(self.parent)
        self._root.title(self.labels.get('about_title', 'About'))
        self._root.geometry('540x620')
        self._root.minsize(480, 560)
        self._root.resizable(True, True)
        self._root.configure(bg=self.colors.get('bg_page', '#f8f9fa'))
        self._root.transient(self.parent)
        self._root.grab_set()
        self._root.protocol('WM_DELETE_WINDOW', self._on_close)

        self._build_ui()
        self._center_window()
        self._root.wait_window()

    def _center_window(self):
        if not self._root:
            return
        self._root.update_idletasks()
        w = self._root.winfo_width()
        h = self._root.winfo_height()
        x = (self._root.winfo_screenwidth() // 2) - (w // 2)
        y = (self._root.winfo_screenheight() // 2) - (h // 2)
        self._root.geometry(f'{w}x{h}+{x}+{y}')

    def _on_close(self):
        if self._root:
            self._root.destroy()
            self._root = None

    def _make_card(self, parent):
        card_bg = self.colors.get('bg_card', '#ffffff')
        border_color = self.colors.get('border', '#dbe3ef')
        card = tk.Frame(
            parent,
            bg=card_bg,
            bd=1,
            relief=tk.SOLID,
            highlightbackground=border_color,
            highlightthickness=1
        )
        return card

    def _build_ui(self):
        root = self._root
        bg = self.colors.get('bg_page', '#f8f9fa')
        card_bg = self.colors.get('bg_card', '#ffffff')
        text_primary = self.colors.get('text_primary', '#333333')
        text_secondary = self.colors.get('text_secondary', '#555555')
        text_muted = self.colors.get('text_muted', '#888888')
        primary = self.colors.get('primary', '#1e40af')

        canvas = tk.Canvas(root, bg=bg, highlightthickness=0)
        scrollbar = ttk.Scrollbar(root, orient=tk.VERTICAL, command=canvas.yview)
        scroll_frame = tk.Frame(canvas, bg=bg)
        scroll_frame.bind('<Configure>',
                          lambda e: canvas.configure(scrollregion=canvas.bbox('all')))
        canvas_window = canvas.create_window((0, 0), window=scroll_frame, anchor='nw')
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        def _on_canvas_configure(event):
            canvas.itemconfig(canvas_window, width=event.width - 4)
        canvas.bind('<Configure>', _on_canvas_configure)

        content = tk.Frame(scroll_frame, bg=bg, padx=28, pady=28)
        content.pack(fill=tk.BOTH, expand=True)

        company = self.branding.get('company_name', 'Websmith Digital™')

        # ── HEADER CARD ──
        header_card = self._make_card(content)
        header_card.pack(fill=tk.X, pady=(0, 20))

        header_inner = tk.Frame(header_card, bg=card_bg, padx=24, pady=20)
        header_inner.pack(fill=tk.BOTH)

        tk.Label(
            header_inner,
            text=company,
            font=("Segoe UI", 20, "bold"),
            bg=card_bg,
            fg=primary
        ).pack(anchor=tk.CENTER)

        tk.Label(
            header_inner,
            text=self.labels.get('about_subtitle',
                                 'Universal License Platform'),
            font=("Segoe UI", 11),
            bg=card_bg,
            fg=text_secondary
        ).pack(anchor=tk.CENTER, pady=(4, 0))

        location = self.branding.get('location',
                                     'Kolkata, West Bengal, India')
        tk.Label(
            header_inner,
            text=location,
            font=("Segoe UI", 9),
            bg=card_bg,
            fg=text_muted
        ).pack(anchor=tk.CENTER, pady=(4, 0))

        # ── PRODUCT INFORMATION CARD (Two-column) ──
        product_card = self._make_card(content)
        product_card.pack(fill=tk.X, pady=(0, 16))

        product_inner = tk.Frame(product_card, bg=card_bg, padx=24, pady=18)
        product_inner.pack(fill=tk.BOTH)

        tk.Label(
            product_inner,
            text=self.labels.get('about_product_info',
                                 'Product Information'),
            font=("Segoe UI", 12, "bold"),
            bg=card_bg,
            fg=text_primary
        ).pack(anchor=tk.W, pady=(0, 14))

        info_data = [
            (self.labels.get('product_label', 'Product'),
             self._get_product_name(),
             self.labels.get('sdk_version_label', 'SDK Version'),
             self._get_sdk_version()),
            (self.labels.get('version_label', 'Version'),
             self._get_product_version(),
             self.labels.get('runtime_label', 'Runtime'),
             self._get_runtime()),
            (self.labels.get('status_label', 'License Status'),
             self._get_license_status(),
             self.labels.get('plan_label', 'Current Plan'),
             self._get_current_plan()),
            (self.labels.get('build_date_label', 'Build Date'),
             self._get_build_date(),
             '', ''),
        ]

        for row_idx, (lbl_l, val_l, lbl_r, val_r) in enumerate(info_data):
            row_frame = tk.Frame(product_inner, bg=card_bg)
            row_frame.pack(fill=tk.X, pady=(0, 6))
            row_frame.columnconfigure(0, weight=1, uniform='col')
            row_frame.columnconfigure(1, weight=1, uniform='col')

            # Left column
            left_frame = tk.Frame(row_frame, bg=card_bg)
            left_frame.grid(row=0, column=0, sticky='nw', padx=(0, 8))
            tk.Label(
                left_frame,
                text=lbl_l,
                font=("Segoe UI", 8, "bold"),
                bg=card_bg,
                fg=text_primary
            ).pack(anchor=tk.W, pady=(0, 1))
            val_widget_l = tk.Label(
                left_frame,
                text=val_l,
                font=("Segoe UI", 10),
                bg=card_bg,
                fg=text_secondary,
                anchor=tk.W,
                wraplength=200
            )
            val_widget_l.pack(anchor=tk.W)

            # Right column
            if lbl_r and val_r:
                right_frame = tk.Frame(row_frame, bg=card_bg)
                right_frame.grid(row=0, column=1, sticky='nw')
                tk.Label(
                    right_frame,
                    text=lbl_r,
                    font=("Segoe UI", 8, "bold"),
                    bg=card_bg,
                    fg=text_primary
                ).pack(anchor=tk.W, pady=(0, 1))
                val_widget_r = tk.Label(
                    right_frame,
                    text=val_r,
                    font=("Segoe UI", 10),
                    bg=card_bg,
                    fg=text_secondary,
                    anchor=tk.W,
                    wraplength=200
                )
                val_widget_r.pack(anchor=tk.W)

        # ── PLATFORM CARD ──
        platform_card = self._make_card(content)
        platform_card.pack(fill=tk.X, pady=(0, 16))

        platform_inner = tk.Frame(platform_card, bg=card_bg, padx=24, pady=18)
        platform_inner.pack(fill=tk.BOTH)

        tk.Label(
            platform_inner,
            text=company,
            font=("Segoe UI", 12, "bold"),
            bg=card_bg,
            fg=text_primary
        ).pack(anchor=tk.W, pady=(0, 6))

        tk.Label(
            platform_inner,
            text="Enterprise License & Activation Platform",
            font=("Segoe UI", 9),
            bg=card_bg,
            fg=text_secondary
        ).pack(anchor=tk.W, pady=(0, 10))

        platform_desc = (
            "Licensing, activation, onboarding,\\n"
            "device security, hardware binding,\\n"
            f"and SDK services are powered by\\n"
            f"{company}."
        )
        tk.Label(
            platform_inner,
            text=platform_desc,
            font=("Segoe UI", 9),
            bg=card_bg,
            fg=text_secondary,
            justify=tk.LEFT
        ).pack(anchor=tk.W)

        # ── ARCHITECTURE CARD ──
        arch_card = self._make_card(content)
        arch_card.pack(fill=tk.X, pady=(0, 16))

        arch_inner = tk.Frame(arch_card, bg=card_bg, padx=24, pady=18)
        arch_inner.pack(fill=tk.BOTH)

        tk.Label(
            arch_inner,
            text=self.labels.get('about_architecture',
                                 'Platform Architecture & Development'),
            font=("Segoe UI", 12, "bold"),
            bg=card_bg,
            fg=text_primary
        ).pack(anchor=tk.W, pady=(0, 10))

        dev_name = self.branding.get('developer_name',
                                     'Mohammad Kalam Khan')
        dev_title = self.branding.get('developer_title',
                                      'Senior Developer')

        tk.Label(
            arch_inner,
            text=dev_name,
            font=("Segoe UI", 10, "bold"),
            bg=card_bg,
            fg=text_primary
        ).pack(anchor=tk.W)

        tk.Label(
            arch_inner,
            text=dev_title,
            font=("Segoe UI", 9),
            bg=card_bg,
            fg=text_secondary
        ).pack(anchor=tk.W, pady=(0, 6))

        year = datetime.now().year
        tk.Label(
            arch_inner,
            text=f"\\u00a9 {year} Websmith Digital",
            font=("Segoe UI", 8),
            bg=card_bg,
            fg=text_muted
        ).pack(anchor=tk.W)

    def _get_product_name(self) -> str:
        return self.config.get('product', {}).get('name', self.labels.get('unknown', 'Unknown'))

    def _get_product_version(self) -> str:
        return self.config.get('product', {}).get('version', self.labels.get('unknown', 'Unknown'))

    def _get_sdk_version(self) -> str:
        try:
            from .. import __version__
            if __version__:
                return __version__
        except ImportError:
            pass
        product = self.config.get('product', {})
        ver = product.get('version')
        if ver and ver != '\${kit_version}':
            return ver
        manifest = self.config.get('manifest', {})
        mkv = manifest.get('kit_version')
        if mkv:
            return mkv
        return '1.0.0'

    def _get_runtime(self) -> str:
        return self.config.get('runtime', 'Python')

    def _get_license_status(self) -> str:
        status = self.engine.get_status()
        if not status:
            status = self.engine.initialize()
        if status and status.valid:
            label = self.labels.get('trial_active_text', 'Trial Active') if status.trial_active else self.labels.get('licensed_text', 'Licensed')
            return f"{label} ({status.days_left} days remaining)"
        return self.labels.get('unlicensed_status', 'Unlicensed')

    def _get_current_plan(self) -> str:
        status = self.engine.get_status()
        if status and status.plan:
            return status.plan
        return self.labels.get('plan_na', 'N/A')

    def _get_build_date(self) -> str:
        manifest = self.config.get('manifest', {})
        generated = manifest.get('generated_at')
        if generated:
            try:
                dt = datetime.fromisoformat(generated.replace('Z', '+00:00'))
                return dt.strftime('%Y-%m-%d')
            except Exception:
                pass
        return datetime.now().strftime('%Y-%m-%d')
`,
    'manifest.json': `{
  "kit_version": "${context.kitVersion}",
  "api_version": "v1",
  "runtime": "python",
  "generated_at": "${new Date().toISOString()}",
  "product_id": "${context.productId}",
  "product_name": "${context.productName}",
  "sdk_type": "universal"
}
`,
  };
}
