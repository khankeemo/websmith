import { PublisherContext } from '../index';

export function getPythonTemplates(context: PublisherContext): Record<string, string> {
  return {
    '__init__.py': `"""${context.productName} SDK - Universal License Center"""
__version__ = "${context.kitVersion}"
__all__ = [
    "UniversalLicenseCenter",
    "UniversalEmailDialog",
    "LicenseEngine", "LicenseStatus",
    "ApiClient", "ApiError",
    "HardwareDetector",
    "CacheManager",
]

from .client import ApiClient, ApiError
from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .cache import CacheManager
from .universal_license_center import UniversalLicenseCenter
from .universal_email_dialog import UniversalEmailDialog
`,
    'client.py': `"""API Client for ${context.productName} License API"""
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

    def send_request(self, request_type: str, customer_name: str, customer_email: str,
                     subject: str = '', message: str = '',
                     license_key: str = '', hardware_id: str = '',
                     plan_name: str = '', product_name: str = '') -> Dict[str, Any]:
        payload = {
            'request_type': request_type,
            'customer_name': customer_name,
            'customer_email': customer_email,
            'product_name': product_name or self.config.get('product', {}).get('name', ''),
            'plan_name': plan_name,
            'license_key': license_key,
            'hardware_id': hardware_id or self._get_hardware_id(),
            'sdk_version': SDK_VERSION,
            'runtime_type': RUNTIME_TYPE,
            'subject': subject or f'{request_type} Request',
            'message': message or f'{request_type} request from SDK',
        }
        return self._request('request', payload)

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

    def get_request_history(self, email: str) -> Dict[str, Any]:
        import requests as _requests
        url = f"{self.base_url}/api/{self.api_version}/request?email={email}"
        try:
            resp = _requests.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return {'success': False, 'requests': []}
        except Exception:
            return {'success': False, 'requests': []}
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
            serial_match = re.search(r'Serial\\s*:\\s*([0-9a-f]+)', content, re.IGNORECASE)
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

    def get_license_status(self) -> Optional[Dict[str, Any]]:
        return self.get('license_status')

    def set_license_status(self, status: Dict[str, Any]) -> None:
        self.set('license_status', status)

    def invalidate_license_status(self) -> None:
        self.delete('license_status')

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

from .client import ApiClient
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
                    pass
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
            trial_msg = (trial_data.get('message', '') or '').lower()
            if 'paid license' in trial_msg or 'paid' in trial_msg:
                self._status = LicenseStatus(
                    valid=False, status='force_reactivation',
                    hardware_id=hardware_id,
                    message='License inactive. Please reactivate or renew.'
                )
                return self._status
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

    def get_available_plans(self, license_key: str) -> Dict[str, Any]:
        return self._client.get_available_plans(license_key)
`,
    'universal_email_dialog.py': `"""Universal Email Dialog - reusable email form for all request types"""
import tkinter as tk
from tkinter import messagebox
from typing import Any, Dict, Optional

from .client import ApiClient
from .hardware import HardwareDetector
from .cache import CacheManager

SDK_VERSION = "${context.kitVersion}"
RUNTIME_TYPE = "${context.runtime}"
SUPPORT_EMAIL = "support@websmithdigital.com"

REQUEST_TYPES = [
    "BUY",
    "RENEW",
    "SUPPORT",
    "ACTIVATION",
    "DEVICE_REPLACEMENT",
    "HARDWARE",
    "GENERAL",
]


class UniversalEmailDialog:
    def __init__(
        self,
        config: Dict[str, Any],
        client: ApiClient,
        hardware: HardwareDetector,
        cache: CacheManager,
    ):
        self.config = config
        self.client = client
        self.hardware = hardware
        self.cache = cache
        self._result: Optional[Dict[str, Any]] = None
        self._root: Optional[tk.Toplevel] = None

        branding = config.get("branding", {})
        self._primary = branding.get("primary_color", "#6366f1")
        self._bg = "#f0f2f5"
        self._card_bg = "#ffffff"
        self._text_primary = "#1a1a2e"
        self._text_secondary = "#6b7280"
        self._border = "#d1d5db"

    def show(
        self,
        request_type: str,
        subject: str = "",
        customer_name: str = "",
        customer_email: str = "",
        license_key: str = "",
        plan_name: str = "",
        hardware_id: str = "",
        message_text: str = "",
    ) -> Dict[str, Any]:
        product_name = self.config.get("product", {}).get("name", "")

        cached = self.cache.get_license_status()
        if not customer_name:
            customer_name = cached.get("customer_name", "") if cached else ""
        if not customer_email:
            customer_email = cached.get("customer_email", "") if cached else ""
        if not hardware_id:
            hardware_id = self.hardware.get_fingerprint()

        self._result = None
        self._root = tk.Toplevel()
        self._root.title(f"{request_type.replace('_', ' ')} Request")
        self._root.geometry("520x580")
        self._root.resizable(False, False)
        self._root.configure(bg=self._bg)
        self._root.transient()
        self._root.grab_set()
        self._root.protocol("WM_DELETE_WINDOW", self._on_close)

        self._build_ui(request_type, product_name, customer_name, customer_email,
                       license_key, plan_name, hardware_id, message_text)
        self._center_window()
        self._root.wait_window()
        return self._result or {"sent": False, "error": "Dialog closed"}

    def _center_window(self):
        if not self._root:
            return
        self._root.update_idletasks()
        w = self._root.winfo_width()
        h = self._root.winfo_height()
        x = (self._root.winfo_screenwidth() // 2) - (w // 2)
        y = (self._root.winfo_screenheight() // 2) - (h // 2)
        self._root.geometry(f"{w}x{h}+{x}+{y}")

    def _build_ui(self, request_type, product_name, customer_name, customer_email,
                  license_key, plan_name, hardware_id, message_text):
        root = self._root
        padding = {"padx": 20, "pady": 4}

        header = tk.Label(root, text=f"Universal Email Form",
                          font=("Segoe UI", 18, "bold"),
                          bg=self._bg, fg=self._text_primary)
        header.pack(pady=(24, 2))
        sub = tk.Label(root, text=f"Request: {request_type.replace('_', ' ')}",
                       font=("Segoe UI", 10), bg=self._bg, fg=self._text_secondary)
        sub.pack(pady=(0, 16))
        if product_name:
            prod_lbl = tk.Label(root, text=f"Product: {product_name}",
                                font=("Segoe UI", 9), bg=self._bg, fg=self._text_secondary)
            prod_lbl.pack(pady=(0, 8))

        frame = tk.Frame(root, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=24, pady=(0, 16))

        tk.Label(frame, text="Your Name *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", **padding)
        self._name_var = tk.StringVar(value=customer_name)
        self._name_entry = tk.Entry(frame, textvariable=self._name_var,
                                     font=("Segoe UI", 11), relief="solid", bd=1)
        self._name_entry.pack(fill="x", padx=20, pady=(0, 8))

        tk.Label(frame, text="Your Email *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", **padding)
        self._email_var = tk.StringVar(value=customer_email)
        self._email_entry = tk.Entry(frame, textvariable=self._email_var,
                                      font=("Segoe UI", 11), relief="solid", bd=1)
        self._email_entry.pack(fill="x", padx=20, pady=(0, 8))

        if license_key:
            tk.Label(frame, text="License Key", font=("Segoe UI", 10, "bold"),
                     bg=self._card_bg, fg=self._text_primary).pack(anchor="w", **padding)
            lk_lbl = tk.Label(frame, text=license_key, font=("Courier", 10),
                              bg=self._card_bg, fg=self._text_secondary)
            lk_lbl.pack(anchor="w", padx=20, pady=(0, 8))

        if plan_name:
            tk.Label(frame, text="Plan", font=("Segoe UI", 10, "bold"),
                     bg=self._card_bg, fg=self._text_primary).pack(anchor="w", **padding)
            plan_lbl = tk.Label(frame, text=plan_name, font=("Segoe UI", 10),
                                bg=self._card_bg, fg=self._text_secondary)
            plan_lbl.pack(anchor="w", padx=20, pady=(0, 8))

        tk.Label(frame, text="Subject", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", **padding)
        self._subject_var = tk.StringVar(
            value=f"{request_type.replace('_', ' ')} Request")
        self._subject_entry = tk.Entry(frame, textvariable=self._subject_var,
                                        font=("Segoe UI", 11), relief="solid", bd=1)
        self._subject_entry.pack(fill="x", padx=20, pady=(0, 8))

        tk.Label(frame, text="Message *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", **padding)
        self._msg_text = tk.Text(frame, font=("Segoe UI", 10), height=5,
                                  wrap="word", relief="solid", bd=1)
        self._msg_text.pack(fill="x", padx=20, pady=(0, 12))
        if message_text:
            self._msg_text.insert("1.0", message_text)

        self._status_label = tk.Label(frame, text="", font=("Segoe UI", 9),
                                       bg=self._card_bg, fg="#16a34a")
        self._status_label.pack(padx=20, pady=(0, 4))

        self._send_btn = tk.Button(frame, text="Send Request",
                                    font=("Segoe UI", 11, "bold"),
                                    bg=self._primary, fg="white", relief="flat",
                                    command=self._on_send, cursor="hand2")
        self._send_btn.pack(fill="x", padx=20, pady=(0, 12))
        self._send_btn.bind("<Enter>", lambda e: self._send_btn.config(bg="#4f46e5"))
        self._send_btn.bind("<Leave>", lambda e: self._send_btn.config(bg=self._primary))

        self._request_type = request_type
        self._product_name = product_name
        self._license_key = license_key
        self._plan_name = plan_name
        self._hardware_id = hardware_id

    def _on_close(self):
        self._result = {"sent": False, "error": "Dialog closed"}
        try:
            self._root.destroy()
        except Exception:
            pass

    def _on_send(self):
        name = self._name_var.get().strip()
        email = self._email_var.get().strip()
        subject = self._subject_var.get().strip()
        msg = self._msg_text.get("1.0", "end").strip()

        if not name or not email:
            messagebox.showwarning("Validation Error",
                                    "Name and email are required.", parent=self._root)
            return
        if not msg:
            messagebox.showwarning("Validation Error",
                                    "Message is required.", parent=self._root)
            return

        self._send_btn.config(state="disabled", text="Sending...")
        self._status_label.config(text="Submitting your request...", fg=self._text_secondary)
        self._root.update()

        try:
            result = self.client.send_request(
                request_type=self._request_type,
                customer_name=name,
                customer_email=email,
                subject=subject,
                message=msg,
                license_key=self._license_key,
                hardware_id=self._hardware_id,
                plan_name=self._plan_name,
                product_name=self._product_name,
            )
            if result.get("success"):
                ref = result.get("data", {}).get("request_id", "")
                messagebox.showinfo(
                    "Request Submitted",
                    f"Your request has been submitted successfully!\\n\\n"
                    f"Reference: {ref}\\n"
                    f"We will contact you at {email} shortly.",
                    parent=self._root,
                )
                self._result = {"sent": True, "request_id": ref}
                self._root.destroy()
            else:
                err = result.get("error", {}).get("message", "Unknown error")
                self._status_label.config(text=f"Failed: {err}", fg="#dc2626")
                self._send_btn.config(state="normal", text="Send Request")
        except Exception as e:
            self._status_label.config(
                text=f"Error: {str(e)}. Email {SUPPORT_EMAIL} directly.",
                fg="#dc2626",
            )
            self._send_btn.config(state="normal", text="Send Request")
`,

    'universal_license_center.py': `"""Universal License Center - unified customer interface for all license operations"""
import json
import os
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any, Dict, Optional

from .client import ApiClient
from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .cache import CacheManager
from .universal_email_dialog import UniversalEmailDialog

SDK_VERSION = "${context.kitVersion}"
RUNTIME_TYPE = "${context.runtime}"
SUPPORT_EMAIL = "support@websmithdigital.com"


def _load_api_config() -> Dict[str, Any]:
    cfg_paths = [
        os.path.join(os.path.dirname(__file__), "config", "api-config.json"),
        os.path.join(os.getcwd(), "config", "api-config.json"),
    ]
    for cfg_path in cfg_paths:
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            continue
    return {}


class UniversalLicenseCenter:
    def __init__(self, config_path: Optional[str] = None):
        self.config = _load_api_config() if config_path is None else self._load_config(config_path)
        self.hardware = HardwareDetector()
        self.cache = CacheManager(self.config)
        self.engine = LicenseEngine(config_path)
        self.client = ApiClient(self.config, self.hardware, self.cache)
        self.email_dialog = UniversalEmailDialog(self.config, self.client, self.hardware, self.cache)
        self._status: Optional[LicenseStatus] = None
        self._root: Optional[tk.Toplevel] = None

        branding = self.config.get("branding", {})
        self._primary = branding.get("primary_color", "#6366f1")
        self._bg = "#f0f2f5"
        self._card_bg = "#ffffff"
        self._text_primary = "#1a1a2e"
        self._text_secondary = "#6b7280"
        self._success = "#16a34a"
        self._error = "#dc2626"
        self._warning = "#f59e0b"
        self._border = "#d1d5db"

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def show(self) -> Dict[str, Any]:
        self._status = self.engine.initialize()
        self._root = tk.Toplevel()
        self._root.title("Universal License Center")
        self._root.geometry("600x700")
        self._root.minsize(520, 620)
        self._root.resizable(True, True)
        self._root.configure(bg=self._bg)
        self._root.transient()
        self._root.grab_set()
        self._build_ui()
        self._refresh_display()
        self._center_window()
        self._root.wait_window()
        return {"status": self._status.to_dict() if self._status else None}

    def _center_window(self):
        if not self._root:
            return
        self._root.update_idletasks()
        w = self._root.winfo_width()
        h = self._root.winfo_height()
        x = (self._root.winfo_screenwidth() // 2) - (w // 2)
        y = (self._root.winfo_screenheight() // 2) - (h // 2)
        self._root.geometry(f"{w}x{h}+{x}+{y}")

    def _build_ui(self):
        root = self._root

        header = tk.Frame(root, bg=self._primary, height=80)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(header, text="Universal License Center",
                 font=("Segoe UI", 20, "bold"),
                 fg="white", bg=self._primary).pack(expand=True)
        tk.Label(header, text=f"SDK v{SDK_VERSION} | Runtime: {RUNTIME_TYPE}",
                 font=("Segoe UI", 8),
                 fg="#e0e7ff", bg=self._primary).pack()

        main = tk.Frame(root, bg=self._bg, padx=20, pady=16)
        main.pack(fill="both", expand=True)

        status_frame = tk.Frame(main, bg=self._card_bg, bd=1, relief="solid",
                                highlightbackground=self._border)
        status_frame.pack(fill="x", pady=(0, 16))

        self._status_header = tk.Label(status_frame, text="License Status",
                                        font=("Segoe UI", 13, "bold"),
                                        bg=self._card_bg, fg=self._text_primary)
        self._status_header.pack(anchor="w", padx=16, pady=(12, 4))

        self._status_detail = tk.Label(status_frame, text="Checking...",
                                        font=("Segoe UI", 10),
                                        bg=self._card_bg, fg=self._text_secondary,
                                        justify="left", wraplength=540)
        self._status_detail.pack(anchor="w", padx=16, pady=(0, 12))

        sep = tk.Frame(main, bg=self._border, height=1)
        sep.pack(fill="x", pady=(0, 12))

        btn_frame = tk.Frame(main, bg=self._bg)
        btn_frame.pack(fill="both", expand=True)

        buttons = [
            ("1. View License Status", self._view_status, self._primary),
            ("2. Start Free Trial", self._start_trial, self._success),
            ("3. Activate License", self._activate_license, self._primary),
            ("4. Buy License", self._buy_license, self._warning),
            ("5. Renew License", self._renew_license, self._primary),
            ("6. Replace Device", self._replace_device, self._warning),
            ("7. Hardware Issue", self._hardware_issue, self._text_secondary),
            ("8. Contact Support", self._contact_support, self._text_secondary),
            ("9. Request History", self._request_history, self._text_secondary),
        ]

        for text, cmd, color in buttons:
            btn = tk.Button(btn_frame, text=text, command=cmd,
                            font=("Segoe UI", 11, "bold"),
                            bg=color, fg="white", relief="flat",
                            padx=12, pady=8, cursor="hand2", anchor="w")
            btn.pack(fill="x", pady=(0, 6))
            btn.bind("<Enter>", lambda e, c=color: e.widget.config(bg=self._adjust_color(c, 0.85)))
            btn.bind("<Leave>", lambda e, c=color: e.widget.config(bg=c))

        tk.Button(btn_frame, text="0. Exit", command=self._on_close,
                  font=("Segoe UI", 10), bg="#e5e7eb", fg=self._text_primary,
                  relief="flat", padx=12, pady=6, cursor="hand2").pack(fill="x", pady=(6, 0))

        self._output_label = tk.Label(main, text="", font=("Segoe UI", 9),
                                       bg=self._bg, fg=self._text_secondary,
                                       wraplength=540, justify="left")
        self._output_label.pack(fill="x", pady=(8, 0))

    @staticmethod
    def _adjust_color(hex_color: str, factor: float) -> str:
        hex_color = hex_color.lstrip("#")
        r = min(255, int(int(hex_color[0:2], 16) * factor))
        g = min(255, int(int(hex_color[2:4], 16) * factor))
        b = min(255, int(int(hex_color[4:6], 16) * factor))
        return f"#{r:02x}{g:02x}{b:02x}"

    def _on_close(self):
        try:
            self._root.destroy()
        except Exception:
            pass

    def _refresh_display(self):
        if not self._status:
            self._status_detail.config(text="Status: Unknown", fg=self._text_secondary)
            return
        lines = []
        lines.append(f"Status: {self._status.status.upper()}")
        if self._status.license_key:
            lines.append(f"License: {self._status.license_key}")
        if self._status.plan:
            lines.append(f"Plan: {self._status.plan}")
        if self._status.expiry_date:
            lines.append(f"Expires: {self._status.expiry_date}")
        if self._status.days_left > 0:
            lines.append(f"Days Remaining: {self._status.days_left}")
        if self._status.hardware_id:
            lines.append(f"Hardware: {self._status.hardware_id[:48]}...")
        if self._status.message:
            lines.append(f"Message: {self._status.message}")

        if self._status.valid:
            fg = self._success
        elif self._status.status == "trial":
            fg = self._warning
        else:
            fg = self._error

        self._status_detail.config(text="\\n".join(lines), fg=fg)

    def _set_output(self, text: str, color: str = "#6b7280"):
        self._output_label.config(text=text, fg=color)

    def _view_status(self):
        self._status = self.engine.initialize()
        self._refresh_display()
        self._set_output("Status refreshed.", self._success)

    def _start_trial(self):
        dialog = tk.Toplevel(self._root)
        dialog.title("Start Free Trial")
        dialog.geometry("400x320")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Start Free Trial", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="Name *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        name_var = tk.StringVar()
        tk.Entry(frame, textvariable=name_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Email *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        email_var = tk.StringVar()
        tk.Entry(frame, textvariable=email_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 12))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        def do_start():
            name = name_var.get().strip()
            email = email_var.get().strip()
            if not name or not email:
                status_lbl.config(text="Name and email are required.", fg=self._error)
                return
            status_lbl.config(text="Starting trial...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.engine.start_trial(email, customer_name=name)
                if result.get("success"):
                    self._status = self.engine.get_status()
                    self._refresh_display()
                    messagebox.showinfo("Trial Started",
                                        f"Trial started successfully!\\nCheck {email} for details.",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get("message", result.get("error", "Unknown error"))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Start Trial", command=do_start,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._success, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _activate_license(self):
        dialog = tk.Toplevel(self._root)
        dialog.title("Activate License")
        dialog.geometry("420x240")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Activate License", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="License Key *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        key_var = tk.StringVar()
        tk.Entry(frame, textvariable=key_var, font=("Courier", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 12))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        def do_activate():
            key = key_var.get().strip()
            if not key:
                status_lbl.config(text="License key is required.", fg=self._error)
                return
            status_lbl.config(text="Activating...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.engine.activate(key)
                if result.get("success"):
                    self._status = self.engine.get_status()
                    self._refresh_display()
                    messagebox.showinfo("Activated", "License activated successfully!",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get("message", result.get("error", "Unknown error"))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Activate", command=do_activate,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _buy_license(self):
        product_name = self.config.get("product", {}).get("name", "our product")
        result = messagebox.askyesno(
            "Buy License",
            f"Interested in buying {product_name}?\\n\\n"
            "Submit your details and our sales team will contact you.\\n\\n"
            "Would you like to use the email form?",
            parent=self._root,
        )
        if result:
            self.email_dialog.show(
                request_type="BUY",
                subject=f"Buy {product_name} License",
            )
        else:
            messagebox.showinfo(
                "Contact Sales",
                f"Please email us at {SUPPORT_EMAIL} to purchase a license.",
                parent=self._root,
            )

    def _renew_license(self):
        if not self._status or not self._status.valid:
            messagebox.showwarning("Not Licensed",
                                    "No active license found. Please activate first.",
                                    parent=self._root)
            return
        result = messagebox.askyesno(
            "Renew License",
            "Would you like to submit a renewal request?\\n\\n"
            "Our team will contact you with renewal options.",
            parent=self._root,
        )
        if result:
            self.email_dialog.show(
                request_type="RENEW",
                subject="License Renewal Request",
                license_key=self._status.license_key or "",
                plan_name=self._status.plan or "",
            )

    def _replace_device(self):
        if not self._status or not self._status.valid:
            messagebox.showwarning("Not Licensed",
                                    "No active license found.", parent=self._root)
            return
        self.email_dialog.show(
            request_type="DEVICE_REPLACEMENT",
            subject="Device Replacement Request",
            license_key=self._status.license_key or "",
            plan_name=self._status.plan or "",
        )

    def _hardware_issue(self):
        self.email_dialog.show(
            request_type="HARDWARE",
            subject="Hardware Issue Report",
        )

    def _contact_support(self):
        dialog = tk.Toplevel(self._root)
        dialog.title("Contact Support")
        dialog.geometry("400x220")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Contact Support", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="Reason:", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))

        reason_var = tk.StringVar(value="support")
        reason_combo = ttk.Combobox(frame, textvariable=reason_var,
                                     values=["support", "activation", "trial", "billing", "other"],
                                     state="readonly", font=("Segoe UI", 10))
        reason_combo.pack(fill="x", padx=16, pady=(0, 12))

        def do_contact():
            reason = reason_var.get()
            rt = "SUPPORT"
            if reason == "activation":
                rt = "ACTIVATION"
            elif reason == "trial":
                rt = "ACTIVATION"
            elif reason == "billing":
                rt = "BUY"
            self.email_dialog.show(
                request_type=rt,
                subject=f"{reason.capitalize()} Support Request",
            )
            dialog.destroy()

        tk.Button(frame, text="Open Email Form", command=do_contact,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _request_history(self):
        dialog = tk.Toplevel(self._root)
        dialog.title("Request History")
        dialog.geometry("500x400")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Request History", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="Enter your email to check request status:",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
            anchor="w", padx=16, pady=(0, 8))

        email_var = tk.StringVar()
        tk.Entry(frame, textvariable=email_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 12))

        result_text = tk.Text(frame, font=("Segoe UI", 9), height=10,
                               wrap="word", relief="solid", bd=1)
        result_text.pack(fill="both", expand=True, padx=16, pady=(0, 12))

        def do_fetch():
            email = email_var.get().strip()
            if not email:
                messagebox.showwarning("Input Required", "Email is required.",
                                       parent=dialog)
                return
            result_text.delete("1.0", "end")
            result_text.insert("1.0", "Fetching request history...\\n")
            dialog.update()
            try:
                data = self.client.get_request_history(email)
                if data.get("success") and data.get("data", {}).get("requests"):
                    requests = data["data"]["requests"]
                    result_text.delete("1.0", "end")
                    for req in requests:
                        rid = req.get("request_id", "")
                        rtype = req.get("request_type", "")
                        status = req.get("status", "")
                        created = req.get("created_at", "")
                        subject = req.get("subject", "")
                        result_text.insert("end",
                                           f"{rid} | {rtype} | {status} | {created}\\n"
                                           f"  Subject: {subject}\\n\\n")
                else:
                    result_text.delete("1.0", "end")
                    result_text.insert("1.0", "No requests found for this email.\\n")
            except Exception as e:
                result_text.delete("1.0", "end")
                result_text.insert("1.0", f"Error fetching history: {str(e)}\\n")

        tk.Button(frame, text="Fetch History", command=do_fetch,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(0, 12))

        dialog.wait_window()
`,
  };
};