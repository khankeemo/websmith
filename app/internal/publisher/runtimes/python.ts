import { PublisherContext } from '../index';

export function getPythonTemplates(context: PublisherContext): Record<string, string> {
  return {
    '__init__.py': `"""${context.productName} SDK - Universal License Center"""
__version__ = "${context.kitVersion}"
__all__ = [
    "UniversalLicenseCenter",
    "WelcomeDialog",
    "LicenseEngine", "LicenseStatus",
    "ApiClient", "ApiError",
    "HardwareDetector",
    "CacheManager",
]

from .client import ApiClient, ApiError
from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .cache import CacheManager
from .welcome import WelcomeDialog
from .universal_license_center import UniversalLicenseCenter
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
        self.product_name = config.get('product', {}).get('name', '')
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
                     plan_name: str = '', product_name: str = '',
                     customer_mobile: str = '', current_plan_id: str = '',
                     current_plan_name: str = '', requested_plan_id: str = '',
                     requested_plan_name: str = '') -> Dict[str, Any]:
        payload = {
            'request_type': request_type,
            'customer_name': customer_name,
            'customer_email': customer_email,
            'customer_mobile': customer_mobile,
            'product_name': product_name or self.product_name,
            'plan_name': plan_name,
            'license_key': license_key,
            'hardware_id': hardware_id or self._get_hardware_id(),
            'sdk_version': SDK_VERSION,
            'runtime_type': RUNTIME_TYPE,
            'subject': subject or f'{request_type} Request',
            'message': message or f'{request_type} request from SDK',
            'current_plan_id': current_plan_id,
            'current_plan_name': current_plan_name,
            'requested_plan_id': requested_plan_id,
            'requested_plan_name': requested_plan_name,
        }
        return self._request('request', payload)

    def send_otp(self, email: str) -> Dict[str, Any]:
        endpoint = 'auth/otp/send'
        payload = {'email': email, 'product_id': self.product_id}
        return self._request(endpoint, payload)

    def verify_otp(self, email: str, otp: str) -> Dict[str, Any]:
        endpoint = 'auth/otp/verify'
        payload = {'email': email, 'otp': otp, 'product_id': self.product_id}
        return self._request(endpoint, payload)

    def register_customer(self, name: str, email: str, mobile: str,
                           country_code: str, hardware_id: str,
                           company_name: str = '') -> Dict[str, Any]:
        endpoint = 'customer/register'
        payload = {
            'name': name, 'email': email, 'mobile': mobile,
            'country_code': country_code, 'hardware_id': hardware_id,
            'company_name': company_name, 'product_id': self.product_id,
        }
        return self._request(endpoint, payload)

    def get_countries(self) -> Dict[str, Any]:
        endpoint = 'countries'
        payload = {'action': 'list'}
        return self._request(endpoint, payload)

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
        payload = {'action': 'activate', 'license_key': license_key, 'hardware_id': hardware_id,
                   'product_id': self.product_id}
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
        url = f"{self.base_url}/api/{self.api_version}/license/details/{license_key}"
        api_path = f"/api/{self.api_version}/license/details/{license_key}"
        headers = self._sign_request({}, method='GET', path=api_path)
        headers['Content-Type'] = 'application/json'
        try:
            resp = requests.get(url, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return {'success': False, 'error': resp.json().get('message', f'HTTP {resp.status_code}')}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_available_plans(self, license_key: str) -> Dict[str, Any]:
        payload: Dict[str, Any] = {'license_key': license_key}
        api_path = f"/api/{self.api_version}/license/verify-renewal"
        headers = self._sign_request(payload, method='POST', path=api_path, query='')
        headers['Content-Type'] = 'application/json'
        url = f"{self.base_url}{api_path}"
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=self.timeout)
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
        url = f"{self.base_url}/api/{self.api_version}/store/products"
        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return {'success': False, 'products': []}
        except Exception:
            return {'success': False, 'products': []}

    def get_request_history(self, email: str) -> Dict[str, Any]:
        url = f"{self.base_url}/api/{self.api_version}/request?email={email}"
        try:
            resp = requests.get(url, timeout=self.timeout)
            if resp.status_code == 200:
                return resp.json()
            return {'success': False, 'requests': []}
        except Exception:
            return {'success': False, 'requests': []}

    def send_reactivation_request(self, license_key: str, customer_name: str = '',
                                  customer_email: str = '', message: str = '') -> Dict[str, Any]:
        payload = {
            'license_key': license_key,
            'customer_name': customer_name or 'SDK User',
            'customer_email': customer_email or '',
            'hardware_id': self._get_hardware_id(),
            'message': message or 'Reactivation request from SDK',
        }
        return self._request('reactivations', payload)

    def send_support_request(self, license_key: str = '', customer_name: str = '',
                             customer_email: str = '', subject: str = '',
                             message: str = '') -> Dict[str, Any]:
        payload = {
            'request_type': 'SUPPORT',
            'license_key': license_key or '',
            'customer_name': customer_name or 'SDK User',
            'customer_email': customer_email or '',
            'hardware_id': self._get_hardware_id(),
            'subject': subject or 'Support Request',
            'message': message or 'Support request from SDK',
        }
        return self._request('support', payload)
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

    def get_license_status(self) -> Optional[Dict[str, Any]]:
        return self.get('license_status')

    def is_hardware_consistent(self, current_hardware_id: str) -> bool:
        status = self.get_license_status()
        if not status:
            return True
        hardware_id = status.get('hardware_id')
        if not hardware_id:
            return True
        return hardware_id == current_hardware_id

    def invalidate_if_hardware_mismatch(self, current_hardware_id: str) -> None:
        if not self.is_hardware_consistent(current_hardware_id):
            self.invalidate_license_status()

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

    def set_onboarding_complete(self) -> None:
        cache = self._load_cache()
        cache['onboarding_complete'] = {'value': True, 'cached_at': time.time()}
        self._save_cache()

    def is_onboarding_complete(self) -> bool:
        return self.get('onboarding_complete') is True

    def mark_has_ever_activated_paid_license(self) -> None:
        cache = self._load_cache()
        cache['has_ever_activated_paid_license'] = {'value': True, 'cached_at': time.time()}
        self._save_cache()

    def has_ever_activated_paid_license(self) -> bool:
        return self.get('has_ever_activated_paid_license') is True
`,
    'license_engine.py': `"""License validation and management engine"""
import json
import logging
from pathlib import Path
from typing import Any, Callable, Dict, Optional

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
    def __init__(self, config_path: Optional[str] = None,
                 on_license_ready: Optional[Callable[[bool], None]] = None):
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
        self.on_license_ready: Optional[Callable[[bool], None]] = on_license_ready
        if not self._license_key:
            self._license_key = self._cache.load_license_key()

    def _notify_ready(self, valid: bool) -> None:
        if self.on_license_ready:
            try:
                self.on_license_ready(valid)
            except Exception:
                pass

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

    @staticmethod
    def _is_valid_status(status: Optional[LicenseStatus]) -> bool:
        if not status:
            return False
        return status.status in ('active', 'trial')

    def initialize(self) -> LicenseStatus:
        hardware_id = self._hardware.get_fingerprint()
        self._cache.invalidate_if_hardware_mismatch(hardware_id)
        if self._cache.is_valid():
            cached = self._cache.get_license_status()
            if cached:
                self._status = LicenseStatus.from_dict(cached)
                if not self._license_key and self._status.license_key:
                    self._license_key = self._status.license_key
                self._notify_ready(self._is_valid_status(self._status))
                return self._status
        try:
            # Priority 1: Validate active paid license from server
            if self._license_key:
                try:
                    result = self._client.validate_license(self._license_key, hardware_id)
                    data = result.get('data', result)
                    if data.get('valid'):
                        status_str = data.get('status', 'active')
                        if status_str == 'expired':
                            self._status = LicenseStatus(
                                valid=False, status='expired',
                                expiry_date=data.get('expiry_date'), days_left=0,
                                plan=data.get('plan'), hardware_id=hardware_id,
                                license_key=self._license_key,
                                message='License has expired. Please renew.',
                                customer_name=data.get('customer_name'),
                                customer_email=data.get('customer_email'),
                            )
                            self._notify_ready(False)
                            return self._status
                        self._status = LicenseStatus(
                            valid=True, status=status_str,
                            expiry_date=data.get('expiry_date'),
                            days_left=data.get('days_left', 0),
                            plan=data.get('plan'), hardware_id=hardware_id,
                            license_key=self._license_key,
                            customer_name=data.get('customer_name'),
                            customer_email=data.get('customer_email'),
                            customer_phone=data.get('customer_phone'),
                            customer_mobile=data.get('customer_mobile'),
                            message='License active'
                        )
                        self._cache.set_license_status(self._status.to_dict())
                        self._cache.mark_has_ever_activated_paid_license()
                        self._notify_ready(True)
                        return self._status
                    else:
                        server_status = data.get('status', '')
                        if server_status == 'expired':
                            self._status = LicenseStatus(
                                valid=False, status='expired',
                                expiry_date=data.get('expiry_date'), days_left=0,
                                plan=data.get('plan'), hardware_id=hardware_id,
                                license_key=self._license_key,
                                message='License has expired. Please renew.'
                            )
                            self._notify_ready(False)
                            return self._status
                        if self._cache.has_ever_activated_paid_license():
                            self._status = LicenseStatus(
                                valid=False, status='force_reactivation',
                                hardware_id=hardware_id, license_key=self._license_key,
                                message='License inactive. Please reactivate.'
                            )
                            self._notify_ready(False)
                            return self._status
                        self._status = LicenseStatus(
                            valid=False, status='force_activation',
                            hardware_id=hardware_id, license_key=self._license_key,
                            message='License key invalid. Please activate.'
                        )
                        self._notify_ready(False)
                        return self._status
                except Exception:
                    if self._cache.has_ever_activated_paid_license():
                        self._status = LicenseStatus(
                            valid=False, status='force_reactivation',
                            hardware_id=hardware_id, license_key=self._license_key,
                            message='License validation failed. Please reactivate.'
                        )
                        self._notify_ready(False)
                        return self._status
                    self._status = LicenseStatus(
                        valid=False, status='force_activation',
                        hardware_id=hardware_id, license_key=self._license_key,
                        message='License validation failed. Please activate.'
                    )
                    self._notify_ready(False)
                    return self._status
            else:
                if self._cache.has_ever_activated_paid_license():
                    self._status = LicenseStatus(
                        valid=False, status='force_reactivation',
                        hardware_id=hardware_id,
                        message='License key missing. Please reactivate.'
                    )
                    self._notify_ready(False)
                    return self._status
            # Priority 2: Check for active trial (only if user never had a paid license)
            if not self._cache.has_ever_activated_paid_license():
                trial_response = self._client.get_trial_status(hardware_id)
                trial_data = trial_response.get('data', {})
                if trial_data.get('has_trial'):
                    status_str = trial_data.get('status', 'trial')
                    if status_str == 'expired':
                        self._status = LicenseStatus(
                            valid=False, status='expired',
                            expiry_date=trial_data.get('expiry_date'), days_left=0,
                            plan=trial_data.get('plan'), hardware_id=hardware_id,
                            message='Trial has expired. Please renew.',
                            customer_name=trial_data.get('customer_name'),
                            customer_email=trial_data.get('customer_email'),
                        )
                        self._notify_ready(False)
                        return self._status
                    self._status = LicenseStatus(
                        valid=status_str == 'active', status=status_str,
                        expiry_date=trial_data.get('expiry_date'),
                        days_left=trial_data.get('days_left', 0),
                        plan=trial_data.get('plan'), hardware_id=hardware_id,
                        message=f"Trial is {status_str}",
                        customer_name=trial_data.get('customer_name'),
                        customer_email=trial_data.get('customer_email'),
                        customer_phone=trial_data.get('customer_phone'),
                        customer_mobile=trial_data.get('customer_mobile')
                    )
                    if self._status.valid:
                        self._cache.set_license_status(self._status.to_dict())
                    self._notify_ready(self._is_valid_status(self._status))
                    return self._status
            # Priority 3: Determine if new customer or force activation
            if self._cache.is_onboarding_complete():
                self._status = LicenseStatus(
                    valid=False, status='force_activation',
                    hardware_id=hardware_id,
                    message='No active license found. Please activate.'
                )
            else:
                self._status = LicenseStatus(
                    valid=False, status='unlicensed',
                    hardware_id=hardware_id,
                    message='No license or trial found'
                )
            self._notify_ready(False)
            return self._status
        except Exception as e:
            logger.exception("Unexpected error during license initialization")
            cached = self._cache.get_license_status()
            if cached:
                status = LicenseStatus.from_dict(cached)
                self._notify_ready(self._is_valid_status(status))
                return status
            self._status = LicenseStatus(
                valid=False, status='error',
                message=f"Unexpected error: {str(e)}"
            )
            self._notify_ready(False)
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
                self._cache.mark_has_ever_activated_paid_license()
            self._notify_ready(True)
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
                self._cache.mark_has_ever_activated_paid_license()
            self._notify_ready(True)
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
            self._notify_ready(self._is_valid_status(self._status))
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
                self._cache.mark_has_ever_activated_paid_license()
            self._notify_ready(self._is_valid_status(self._status))
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
            self._cache.mark_has_ever_activated_paid_license()
            self._notify_ready(self._is_valid_status(self._status))
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
                self._cache.mark_has_ever_activated_paid_license()
            self._notify_ready(self._is_valid_status(self._status))
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
                self._cache.mark_has_ever_activated_paid_license()
            self._notify_ready(self._is_valid_status(self._status))
        return result

    def verify_license_for_renewal(self, license_key: str) -> Dict[str, Any]:
        return self._client.verify_license_for_renewal(license_key)

    def get_license_details(self, license_key: str) -> Dict[str, Any]:
        return self._client.get_license_details(license_key)

    def get_available_plans(self, license_key: str) -> Dict[str, Any]:
        return self._client.get_available_plans(license_key)

    def send_renewal_request(self, license_key: str, customer_name: str = '',
                             customer_email: str = '', customer_mobile: str = '',
                             message: str = '', request_type: str = 'renew',
                             current_plan_id: str = '', current_plan_name: str = '',
                             requested_plan_id: str = '', requested_plan_name: str = '') -> Dict[str, Any]:
        return self._client.send_request(
            request_type=request_type, customer_name=customer_name,
            customer_email=customer_email, customer_mobile=customer_mobile,
            message=message, license_key=license_key,
            current_plan_id=current_plan_id, current_plan_name=current_plan_name,
            requested_plan_id=requested_plan_id, requested_plan_name=requested_plan_name,
        )

    def send_reactivation_request(self, license_key: str, customer_name: str = '',
                                  customer_email: str = '', message: str = '') -> Dict[str, Any]:
        return self._client.send_reactivation_request(
            license_key=license_key, customer_name=customer_name,
            customer_email=customer_email, message=message,
        )

    def send_support_request(self, license_key: str = '', customer_name: str = '',
                             customer_email: str = '', subject: str = '',
                             message: str = '') -> Dict[str, Any]:
        return self._client.send_support_request(
            license_key=license_key, customer_name=customer_name,
            customer_email=customer_email, subject=subject, message=message,
        )
`,
    'welcome.py': `"""Welcome Dialog - Customer onboarding with OTP verification and trial generation"""
import json
import os
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any, Dict, Optional

from .client import ApiClient
from .hardware import HardwareDetector
from .cache import CacheManager

SDK_VERSION = "${context.kitVersion}"
RUNTIME_TYPE = "${context.runtime}"


_COUNTRIES_CACHE: list = []


class WelcomeDialog:
    def __init__(self, client: ApiClient, hardware: HardwareDetector,
                 cache: CacheManager, product_name: str = ''):
        self.client = client
        self.hardware = hardware
        self.cache = cache
        self.product_name = product_name
        self._result: Optional[Dict[str, Any]] = None
        self._root: Optional[tk.Toplevel] = None
        self._countries = []
        self._selected_country = None
        self._otp_sent = False
        branding = client.config.get('branding', {})
        self._primary = branding.get('primary_color', '#6366f1')
        self._bg = '#f0f2f5'
        self._card_bg = '#ffffff'
        self._text_primary = '#1a1a2e'
        self._text_secondary = '#6b7280'
        self._success = '#10b981'
        self._error = '#ef4444'
        self._border = '#d1d5db'

    def is_onboarding_complete(self) -> bool:
        return self.cache.is_onboarding_complete()

    def show(self) -> Dict[str, Any]:
        if self.is_onboarding_complete():
            return {'skipped': True, 'message': 'Onboarding already completed'}
        self._result = None
        self._root = tk.Toplevel()
        self._root.title(self.product_name or 'Welcome')
        self._root.geometry('480x580')
        self._root.resizable(False, False)
        self._root.configure(bg=self._bg)
        self._root.transient()
        self._root.grab_set()
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
        company = self.product_name or 'License'
        footer = tk.Label(self._root, text=f'Protected by {company}',
                          font=('Helvetica', 9), bg=self._bg, fg='#9ca3af')
        footer.pack(side='bottom', pady=(0, 15))

    def _load_countries(self):
        global _COUNTRIES_CACHE
        if _COUNTRIES_CACHE:
            self._set_countries(_COUNTRIES_CACHE)
            return
        try:
            result = self.client.get_countries()
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
            result = self.client.send_otp(email)
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
            result = self.client.verify_otp(email, otp)
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
        self._status_label.config(text='Creating your account...', fg=self._primary)
        self._root.update()
        try:
            register_result = self.client.register_customer(
                name=name, email=email, mobile=mobile,
                country_code=country_code, hardware_id=hardware_id,
                company_name=company
            )
            self._status_label.config(text='Starting your free trial...', fg=self._primary)
            self._root.update()
            trial_result = self.client.start_trial(email, name, {
                'mobile': mobile, 'country_code': country_code,
                'company_name': company, 'hardware_id': hardware_id
            })
            if trial_result.get('success'):
                self.cache.set_onboarding_complete()
                self._result = {
                    'name': name, 'email': email, 'hardware_id': hardware_id,
                    'onboarding_complete': True, 'trial_started': True
                }
                self._status_label.config(text='Trial activated! You can now use the software.', fg=self._success)
                self._root.after(2000, self._root.destroy)
            else:
                err = trial_result.get('message', trial_result.get('error', 'Failed to start trial'))
                self._show_error(err)
                self._verify_btn.config(state='normal', text='Verify')
        except Exception as e:
            self._show_error(str(e))
            self._verify_btn.config(state='normal', text='Verify')

    def _show_error(self, msg: str):
        self._error_label.config(text=msg)

    def _clear_error(self):
        self._error_label.config(text='')
`,
    'universal_license_center.py': `"""Universal License Center - single customer experience for all license operations"""
import json
import os
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any, Callable, Dict, Optional

from .client import ApiClient
from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .cache import CacheManager
from .welcome import WelcomeDialog

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
    def __init__(self, config_path: Optional[str] = None,
                 on_license_ready: Optional[Callable[[bool], None]] = None):
        self.config = _load_api_config() if config_path is None else self._load_config(config_path)
        self.hardware = HardwareDetector()
        self.cache = CacheManager(self.config)
        self.client = ApiClient(self.config, self.hardware, self.cache)
        self.engine = LicenseEngine(config_path, on_license_ready=self._on_engine_ready)
        self.on_license_ready = on_license_ready
        self._status: Optional[LicenseStatus] = None
        self._root: Optional[tk.Toplevel] = None
        self._app_unlocked = False

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
        self._product_name = self.config.get("product", {}).get("name", "")

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _on_engine_ready(self, valid: bool):
        if valid:
            self._app_unlocked = True
        else:
            self._app_unlocked = False
        if self.on_license_ready:
            self.on_license_ready(valid)

    def _is_valid_for_unlock(self) -> bool:
        if not self._status:
            return False
        return self._status.status in ('active', 'trial')

    def _unlock_application(self):
        self._app_unlocked = True
        if self.on_license_ready:
            self.on_license_ready(True)

    def _lock_application(self):
        self._app_unlocked = False
        if self.on_license_ready:
            self.on_license_ready(False)

    def show(self) -> Dict[str, Any]:
        self._lock_application()
        self._status = self.engine.initialize()
        status = self._status.status if self._status else 'unlicensed'

        if self._is_valid_for_unlock():
            self._unlock_application()

        if status == 'unlicensed' or (not self._status):
            if not self.cache.is_onboarding_complete():
                result = self._show_welcome()
                if result.get('trial_started') or result.get('onboarding_complete'):
                    self._status = self.engine.initialize()
                    if self._is_valid_for_unlock():
                        self._unlock_application()
                    return {'action': 'trial_started', 'status': self._status.to_dict() if self._status else None}
                if result.get('skipped') and not result.get('closed'):
                    return {'action': 'skipped', 'locked': True}
                return {'action': 'closed', 'locked': True}

        return self._show_license_center()

    def _show_welcome(self) -> Dict[str, Any]:
        welcome = WelcomeDialog(
            client=self.client,
            hardware=self.hardware,
            cache=self.cache,
            product_name=self._product_name
        )
        return welcome.show()

    def _show_license_center(self) -> Dict[str, Any]:
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
        return {"status": self._status.to_dict() if self._status else None,
                "unlocked": self._app_unlocked}

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

        status = self._status.status if self._status else 'unlicensed'
        is_valid = self._status.valid if self._status else False
        is_expired = status in ('expired', 'force_reactivation')
        is_trial = status == 'trial'
        is_paid = status == 'active' and is_valid

        if is_trial:
            buttons = [
                ("Activate License", self._activate_license, self._primary),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]
        elif is_paid:
            buttons = [
                ("Renew License", self._renew_license, self._primary),
                ("Replace Device", self._replace_device, self._warning),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]
        elif is_expired:
            buttons = [
                ("Renew License", self._renew_license, self._primary),
                ("Reactivate License", self._reactivate_license, self._warning),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]
        else:
            buttons = [
                ("Start Free Trial", self._start_trial, self._success),
                ("Activate License", self._activate_license, self._primary),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]

        for text, cmd, color in buttons:
            if color == "#e5e7eb":
                btn = tk.Button(btn_frame, text=text, command=cmd,
                                font=("Segoe UI", 11),
                                bg=color, fg=self._text_primary,
                                relief="flat", padx=12, pady=8, cursor="hand2")
            else:
                btn = tk.Button(btn_frame, text=text, command=cmd,
                                font=("Segoe UI", 11, "bold"),
                                bg=color, fg="white", relief="flat",
                                padx=12, pady=8, cursor="hand2")
            btn.pack(fill="x", pady=(0, 6))

        self._output_label = tk.Label(main, text="", font=("Segoe UI", 9),
                                       bg=self._bg, fg=self._text_secondary,
                                       wraplength=540, justify="left")
        self._output_label.pack(fill="x", pady=(8, 0))

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

    def _start_trial(self):
        self._on_close()
        result = self._show_welcome()
        if result.get('trial_started'):
            self._status = self.engine.initialize()
            if self._status and self._status.valid:
                self._unlock_application()
                messagebox.showinfo("Trial Started",
                                    "Your free trial has been activated!",
                                    parent=self._root)
        elif result.get('closed'):
            self._show_license_center()

    def _activate_license(self):
        dialog = tk.Toplevel(self._root)
        dialog.title("Activate License")
        dialog.geometry("520x480")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Activate License", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="Hardware ID", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        hw_id = self.hardware.get_fingerprint()
        tk.Label(frame, text=hw_id[:48], font=("Courier", 9),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=450).pack(anchor="w", padx=16, pady=(0, 8))

        tk.Label(frame, text="License Key *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        key_var = tk.StringVar()
        if self._status and self._status.license_key:
            key_var.set(self._status.license_key)
        tk.Entry(frame, textvariable=key_var, font=("Courier", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 12))

        if self._status and self._status.customer_name:
            tk.Label(frame, text="Customer", font=("Segoe UI", 10, "bold"),
                     bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
            cust_info = self._status.customer_name
            if self._status.customer_email:
                cust_info += f" \\u2022 {self._status.customer_email}"
            tk.Label(frame, text=cust_info, font=("Segoe UI", 10),
                     bg=self._card_bg, fg=self._text_secondary).pack(anchor="w", padx=16, pady=(0, 12))

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
                    self._unlock_application()
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

    def _renew_license(self):
        if not self._status:
            messagebox.showwarning("Not Available", "No license information available.",
                                    parent=self._root)
            return

        dialog = tk.Toplevel(self._root)
        dialog.title("Renew License")
        dialog.geometry("560x580")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Renew License", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="Current License", font=("Segoe UI", 11, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        current_info = f"Plan: {self._status.plan or 'N/A'}"
        if self._status.expiry_date:
            current_info += f" | Expires: {self._status.expiry_date}"
        if self._status.license_key:
            current_info += f"\\nKey: {self._status.license_key}"
        tk.Label(frame, text=current_info, font=("Segoe UI", 10),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=480, justify="left").pack(anchor="w", padx=16, pady=(0, 12))

        ttk.Separator(frame, orient="horizontal").pack(fill="x", padx=16, pady=8)

        tk.Label(frame, text="Request Renewal", font=("Segoe UI", 11, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        tk.Label(frame, text="Our team will contact you with renewal options.",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
            anchor="w", padx=16, pady=(0, 8))

        tk.Label(frame, text="Your Name *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        name_var = tk.StringVar(value=self._status.customer_name or "")
        tk.Entry(frame, textvariable=name_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Your Email *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        email_var = tk.StringVar(value=self._status.customer_email or "")
        tk.Entry(frame, textvariable=email_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Your Mobile", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        mobile_var = tk.StringVar(value=self._status.customer_mobile or self._status.customer_phone or "")
        tk.Entry(frame, textvariable=mobile_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 12))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        def do_send():
            name = name_var.get().strip()
            email = email_var.get().strip()
            if not name or not email:
                status_lbl.config(text="Name and email are required.", fg=self._error)
                return
            status_lbl.config(text="Submitting renewal request...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.engine.send_renewal_request(
                    license_key=self._status.license_key or "",
                    customer_name=name, customer_email=email,
                    customer_mobile=mobile_var.get().strip(),
                    request_type='renew',
                    current_plan_id='', current_plan_name=self._status.plan or '',
                )
                if result.get("success"):
                    messagebox.showinfo("Request Submitted",
                                        "Your renewal request has been submitted.\\n"
                                        "Our team will contact you shortly.",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get("message", result.get("error", "Failed"))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Submit Renewal Request", command=do_send,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _reactivate_license(self):
        if not self._status:
            messagebox.showwarning("Not Available", "No license information available.",
                                    parent=self._root)
            return

        dialog = tk.Toplevel(self._root)
        dialog.title("Reactivate License")
        dialog.geometry("520x500")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Reactivate License", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))
        tk.Label(frame, text="Submit a reactivation request to restore your license.",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
            anchor="w", padx=16, pady=(0, 12))

        tk.Label(frame, text="License Key", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        key_var = tk.StringVar(value=self._status.license_key or "")
        tk.Entry(frame, textvariable=key_var, font=("Courier", 11),
                 relief="solid", bd=1, state="readonly").pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Customer Name *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        name_var = tk.StringVar(value=self._status.customer_name or "")
        tk.Entry(frame, textvariable=name_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Email *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        email_var = tk.StringVar(value=self._status.customer_email or "")
        tk.Entry(frame, textvariable=email_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Mobile", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        mobile_var = tk.StringVar(value=self._status.customer_mobile or self._status.customer_phone or "")
        tk.Entry(frame, textvariable=mobile_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Hardware ID", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        hw_id = self.hardware.get_fingerprint()
        tk.Label(frame, text=hw_id, font=("Courier", 9),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=450).pack(anchor="w", padx=16, pady=(0, 12))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        def do_send():
            name = name_var.get().strip()
            email = email_var.get().strip()
            if not name or not email:
                status_lbl.config(text="Name and email are required.", fg=self._error)
                return
            status_lbl.config(text="Submitting reactivation request...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.engine.send_reactivation_request(
                    license_key=key_var.get().strip(),
                    customer_name=name,
                    customer_email=email,
                    message='',
                )
                if result.get("success"):
                    messagebox.showinfo("Request Submitted",
                                        "Your reactivation request has been submitted.\\n"
                                        "Our team will contact you shortly.",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get("message", result.get("error", "Failed"))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Submit Reactivation Request", command=do_send,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._warning, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _replace_device(self):
        if not self._status or not self._status.valid:
            messagebox.showwarning("Not Licensed",
                                    "No active license found.", parent=self._root)
            return
        dialog = tk.Toplevel(self._root)
        dialog.title("Replace Device")
        dialog.geometry("500x400")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Device Replacement", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))
        tk.Label(frame, text="Submit a device replacement request.",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
            anchor="w", padx=16, pady=(0, 12))

        tk.Label(frame, text="License Key", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        lk_lbl = tk.Label(frame, text=self._status.license_key or "N/A",
                          font=("Courier", 10), bg=self._card_bg, fg=self._text_secondary)
        lk_lbl.pack(anchor="w", padx=16, pady=(0, 8))

        tk.Label(frame, text="Current Hardware", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        old_hw = self._status.hardware_id or "Unknown"
        tk.Label(frame, text=old_hw, font=("Courier", 9),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=420).pack(anchor="w", padx=16, pady=(0, 8))

        tk.Label(frame, text="New Hardware", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        new_hw = self.hardware.get_fingerprint()
        tk.Label(frame, text=new_hw, font=("Courier", 9),
                 bg=self._card_bg, fg=self._text_primary,
                 wraplength=420).pack(anchor="w", padx=16, pady=(0, 12))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        def do_replace():
            status_lbl.config(text="Replacing device...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.engine.replace_hardware()
                if result.get("success"):
                    self._status = self.engine.get_status()
                    self._refresh_display()
                    messagebox.showinfo("Device Replaced",
                                        "Device has been replaced successfully!",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get("message", result.get("error", "Failed"))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Replace Device", command=do_replace,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._warning, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _contact_support(self):
        dialog = tk.Toplevel(self._root)
        dialog.title("Contact Support")
        dialog.geometry("500x440")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Contact Support", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))
        tk.Label(frame, text="We already know who you are. Just tell us what you need.",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
            anchor="w", padx=16, pady=(0, 12))

        cached = self.cache.get_license_status() or {}

        tk.Label(frame, text="Your Name *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        name_var = tk.StringVar(value=self._status.customer_name if self._status else cached.get('customer_name', ''))
        tk.Entry(frame, textvariable=name_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Your Email *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        email_var = tk.StringVar(value=self._status.customer_email if self._status else cached.get('customer_email', ''))
        tk.Entry(frame, textvariable=email_var, font=("Segoe UI", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        tk.Label(frame, text="Message *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        msg_text = tk.Text(frame, font=("Segoe UI", 10), height=4,
                           wrap="word", relief="solid", bd=1)
        msg_text.pack(fill="x", padx=16, pady=(0, 12))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        def do_send():
            name = name_var.get().strip()
            email = email_var.get().strip()
            msg = msg_text.get("1.0", "end").strip()
            if not name or not email:
                status_lbl.config(text="Name and email are required.", fg=self._error)
                return
            if not msg:
                status_lbl.config(text="Please describe your issue.", fg=self._error)
                return
            status_lbl.config(text="Sending your request...", fg=self._text_secondary)
            dialog.update()
            try:
                license_key = self._status.license_key if self._status else cached.get('license_key', '')
                result = self.engine.send_support_request(
                    license_key=license_key or '',
                    customer_name=name,
                    customer_email=email,
                    subject='Support Request',
                    message=msg,
                )
                if result.get("success"):
                    messagebox.showinfo("Request Submitted",
                                        "Your support request has been sent.\\n"
                                        "We will contact you at " + email + ".",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get("message", result.get("error", "Failed"))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Send Request", command=do_send,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=12, pady=6, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()
`,
  };
};
