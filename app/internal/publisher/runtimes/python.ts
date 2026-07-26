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
        response = self._request('license', payload)
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

    # ====================================================================
    # Message Queue (Offline Retry)
    # ====================================================================

    def queue_message(self, msg: Dict[str, Any]) -> None:
        queue = self.get_message_queue()
        msg['id'] = msg.get('id', f"q_{int(time.time())}_{os.urandom(4).hex()}")
        msg['status'] = msg.get('status', 'pending')
        msg['retry_count'] = msg.get('retry_count', 0)
        msg['max_retries'] = msg.get('max_retries', 5)
        msg['created_at'] = msg.get('created_at', int(time.time()))
        msg['next_retry_at'] = msg.get('next_retry_at', int(time.time()) + 60)
        queue.append(msg)
        self.set('message_queue', queue)

    def get_message_queue(self) -> list:
        return self.get('message_queue') or []

    def save_message_queue(self, queue: list) -> None:
        self.set('message_queue', queue)

    def cleanup_sent_messages(self) -> None:
        queue = [m for m in self.get_message_queue() if m.get('status') != 'sent']
        self.save_message_queue(queue)

    def get_pending_count(self) -> int:
        return len([m for m in self.get_message_queue() if m.get('status') in ('pending', 'failed')])

    def reset_all(self) -> None:
        self.clear()
        self.clear_license_key()
`,
    'license_engine.py': `"""License validation and management engine"""
import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

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

    def _notify_ready(self, valid: bool) -> None:
        if self.on_license_ready:
            try:
                self.on_license_ready(valid)
            except Exception:
                pass

    def _process_message_queue(self) -> None:
        queue = self._cache.get_message_queue()
        changed = False
        for msg in queue:
            if msg.get('status') == 'sent':
                continue
            now_ts = int(time.time())
            if now_ts < msg.get('next_retry_at', 0):
                continue
            if msg.get('retry_count', 0) >= msg.get('max_retries', 5):
                continue
            msg['status'] = 'sending'
            try:
                self._client.create_communication(
                    category=msg.get('category', 'general'),
                    customer_email=msg.get('customer_email', ''),
                    customer_name=msg.get('customer_name', ''),
                    subject=msg.get('subject', ''),
                    message=msg.get('message', ''),
                    product_id=msg.get('product_id', ''),
                    license_key=msg.get('license_key', ''),
                    hardware_id=msg.get('hardware_id', self._hardware.get_fingerprint()),
                    sdk_version=msg.get('sdk_version', ''),
                    runtime_type=msg.get('runtime_type', ''),
                )
                msg['status'] = 'sent'
                changed = True
            except Exception as e:
                msg['retry_count'] = msg.get('retry_count', 0) + 1
                msg['last_error'] = str(e)
                exp_backoff = pow(2, msg['retry_count']) * 60
                msg['next_retry_at'] = now_ts + exp_backoff
                msg['status'] = 'failed'
                changed = True
        if changed:
            self._cache.save_message_queue(queue)
            self._cache.cleanup_sent_messages()

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
        self._process_message_queue()
        print(f"[{time.strftime('%H:%M:%S')}] License Engine initialize — hardware: {hardware_id[:16]}...")
        if self._cache.is_valid():
            cached = self._cache.get_license_status()
            if cached:
                self._status = LicenseStatus.from_dict(cached)
                if not self._license_key and self._status.license_key:
                    self._license_key = self._status.license_key
                print(f"{time.strftime('%H:%M:%S')} Customer found (cache hit) — status: {self._status.status}")
                self._notify_ready(self._is_valid_status(self._status))
                return self._status
        print(f"{time.strftime('%H:%M:%S')} Cache miss or invalid — checking server")
        try:
            # Load persisted license key if not already in memory
            if not self._license_key:
                self._license_key = self._cache.load_license_key()

            # Priority 1: Validate active paid license from server
            if self._license_key:
                print(f"{time.strftime('%H:%M:%S')} License validation started — key: {self._license_key[:8]}...")
                try:
                    result = self._client.validate_license(self._license_key, hardware_id)
                    data = result.get('data', result)
                    if data.get('valid'):
                        status_str = data.get('status', 'active')
                        if status_str == 'expired':
                            print(f"{time.strftime('%H:%M:%S')} License status: expired — key: {self._license_key[:8]}...")
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
                        print(f"{time.strftime('%H:%M:%S')} License status: {status_str} — key: {self._license_key[:8]}...")
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
                        self._cache.set_onboarding_complete()
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
                            print(f"{time.strftime('%H:%M:%S')} License status: force_reactivation — key: {self._license_key[:8]}...")
                            self._status = LicenseStatus(
                                valid=False, status='force_reactivation',
                                hardware_id=hardware_id, license_key=self._license_key,
                                message='License inactive. Please reactivate.'
                            )
                            self._notify_ready(False)
                            return self._status
                        print(f"{time.strftime('%H:%M:%S')} License status: force_activation — key invalid")
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
                print(f"{time.strftime('%H:%M:%S')} Trial check started — hardware: {hardware_id[:16]}...")
                trial_response = self._client.get_trial_status(hardware_id)
                trial_data = trial_response.get('data', {})
                if trial_data.get('has_trial'):
                    status_str = trial_data.get('status', 'trial')
                    print(f"{time.strftime('%H:%M:%S')} Trial status: {status_str}")
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
                print(f"{time.strftime('%H:%M:%S')} Decision: force_activation (onboarding complete, no active license)")
                self._status = LicenseStatus(
                    valid=False, status='force_activation',
                    hardware_id=hardware_id,
                    message='No active license found. Please activate.'
                )
            else:
                print(f"{time.strftime('%H:%M:%S')} Decision: unlicensed (new customer)")
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
            raise ValueError("License key unavailable.")
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
                self._cache.mark_has_ever_activated_paid_license()
                self._cache.set_onboarding_complete()
            self._notify_ready(True)
        return result

    def validate_hardware(self) -> Dict[str, Any]:
        hardware_id = self._hardware.get_fingerprint()
        result = self._client.validate_license('', hardware_id)
        if result.get('success'):
            data = result.get('data', result)
            if data.get('valid'):
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
                self._notify_ready(True)
                return {'success': True, 'data': self._status.to_dict()}
            else:
                server_status = data.get('status', '')
                err_code = data.get('error', {}).get('code', '')
                err_msg = data.get('error', {}).get('message', '') or data.get('message', '')
                if err_code:
                    return {'success': False, 'valid': False, 'error': {'code': err_code, 'message': err_msg}, 'status': server_status}
                return {'success': False, 'valid': False, 'message': err_msg or 'License validation failed'}
        else:
            err_code = result.get('error', {}).get('code', '')
            if err_code == 'NO_LICENSE_FOUND':
                return {'success': False, 'error': {'code': 'NO_LICENSE_FOUND', 'message': 'No license found for this hardware'}}
            return {'success': False, 'error': result.get('error', {'code': '', 'message': result.get('message', 'Unknown error')})}

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
            self._cache.reset_all()
            self._status = None
            self._license_key = None
        return result

    def view_hardware_status(self) -> Dict[str, Any]:
        status = {"current_hardware_id": self._hardware.get_fingerprint()}
        cached = self._cache.get_license_status()
        if cached and cached.get('hardware_id'):
            status["registered_hardware_id"] = cached.get('hardware_id')
            status["matched"] = status["current_hardware_id"] == cached.get('hardware_id')
        status["message"] = "Hardware replacement requires administrator approval. Please contact support."
        return status

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

    def send_support_request(self, license_key: str = '',
                             customer_name: str = '',
                             customer_email: str = '', subject: str = '',
                             message: str = '') -> Dict[str, Any]:
        return self._client.send_support_request(
            license_key=license_key, customer_name=customer_name,
            customer_email=customer_email, subject=subject, message=message,
        )

    # ====================================================================
    # Universal Communication Engine
    # ====================================================================

    def create_communication(self, category: str = 'general',
                             customer_email: str = '',
                             customer_name: str = '',
                             subject: str = '', message: str = '',
                             product_id: str = '', license_key: str = '',
                             hardware_id: str = '', sdk_version: str = '',
                             runtime_type: str = '') -> Dict[str, Any]:
        try:
            return self._client.create_communication(
                category=category, customer_email=customer_email,
                customer_name=customer_name, subject=subject,
                message=message, product_id=product_id,
                license_key=license_key,
                hardware_id=hardware_id or self._hardware.get_fingerprint(),
                sdk_version=sdk_version, runtime_type=runtime_type,
            )
        except Exception as e:
            self._cache.queue_message({
                'category': category, 'customer_email': customer_email,
                'customer_name': customer_name, 'subject': subject,
                'message': message, 'product_id': product_id,
                'license_key': license_key,
                'hardware_id': hardware_id or self._hardware.get_fingerprint(),
                'sdk_version': sdk_version, 'runtime_type': runtime_type,
            })
            return {'success': False, 'message': 'Message queued for delivery when online.', 'queued': True}

    def get_conversation(self, conversation_id: str) -> Dict[str, Any]:
        return self._client.get_conversation(conversation_id)

    def reply_to_conversation(self, conversation_id: str, message: str,
                              customer_name: str = '',
                              customer_email: str = '') -> Dict[str, Any]:
        try:
            return self._client.reply_to_conversation(
                conversation_id, message, customer_name, customer_email)
        except Exception:
            cached = self._cache.get_license_status() or {}
            self._cache.queue_message({
                'category': 'general',
                'customer_email': customer_email or cached.get('customer_email', ''),
                'customer_name': customer_name or cached.get('customer_name', ''),
                'subject': f'Reply to conversation {conversation_id}',
                'message': message,
            })
            return {'success': False, 'message': 'Reply queued for delivery when online.', 'queued': True}

    def list_conversations(self, email: str) -> Dict[str, Any]:
        return self._client.list_conversations(email)

    def get_notifications(self, email: str) -> Dict[str, Any]:
        return self._client.get_notifications(email)

    def mark_notification_read(self, notification_id: str) -> Dict[str, Any]:
        return self._client.mark_notification_read(notification_id)

    def get_unread_notification_count(self, email: str) -> Dict[str, Any]:
        return self._client.get_unread_notification_count(email)
`,
    'welcome.py': `"""Welcome Dialog - Customer onboarding with OTP verification and trial generation"""
import json
import os
import traceback
import tkinter as tk
from tkinter import messagebox, ttk
from typing import Any, Callable, Dict, Optional

from .client import ApiClient
from .hardware import HardwareDetector
from .cache import CacheManager

SDK_VERSION = "${context.kitVersion}"
RUNTIME_TYPE = "${context.runtime}"


_COUNTRIES_CACHE: list = []


class WelcomeDialog:
    def __init__(self, client: ApiClient, hardware: HardwareDetector,
                 cache: CacheManager, product_name: str = '',
                 log_fn: Optional[Callable[[str, str, str, Optional[str]], None]] = None):
        self.client = client
        self.hardware = hardware
        self.cache = cache
        self.product_name = product_name
        self._log_fn = log_fn
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

    def _log(self, category: str, level: str, message: str, detail: Optional[str] = None):
        if self._log_fn:
            try:
                self._log_fn(category, level, message, detail)
            except Exception:
                pass

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
                                     command=self._on_send_otp, cursor='hand2',
                                     padx=12, pady=6)
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
                                       state='disabled',
                                       padx=12, pady=6)
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
        self._log("OTP", "INFO", "Sending welcome OTP", f"email={email}")
        self._send_btn.config(state='disabled', text='Sending...')
        self._clear_error()
        try:
            result = self.client.send_otp(email)
            if result.get('success'):
                self._otp_sent = True
                self._log("OTP", "SUCCESS", "Welcome OTP sent successfully", f"email={email}")
                self._status_label.config(text='OTP sent to your email', fg=self._success)
                self._otp_entry.config(state='normal')
                self._verify_btn.config(state='normal')
                self._send_btn.config(text='Resend OTP', state='normal')
            else:
                err_msg = result.get('error', result.get('message', 'Failed to send OTP'))
                self._log("OTP", "ERROR", "Welcome OTP send failed", str(err_msg))
                self._show_error(err_msg)
                self._send_btn.config(state='normal', text='Send OTP')
        except Exception as e:
            self._log("OTP", "ERROR", "Welcome OTP send exception", str(e))
            self._show_error(str(e))
            self._send_btn.config(state='normal', text='Send OTP')

    def _on_verify_otp(self):
        email = self._email_entry.get().strip()
        otp = self._otp_entry.get().strip()
        if not otp or len(otp) < 4:
            self._show_error('Enter the OTP code')
            return
        self._log("OTP", "INFO", "OTP verification started", f"email={email}")
        self._verify_btn.config(state='disabled', text='Verifying...')
        self._clear_error()
        try:
            result = self.client.verify_otp(email, otp)
            if result.get('success'):
                self._log("OTP", "SUCCESS", "OTP verified successfully", f"email={email}")
                if result.get('customer_exists'):
                    self._handle_existing_customer()
                else:
                    self._complete_onboarding()
            else:
                err_msg = result.get('error', result.get('message', 'Invalid OTP'))
                self._log("OTP", "ERROR", "OTP verification failed", str(err_msg))
                self._show_error(err_msg)
                self._verify_btn.config(state='normal', text='Verify')
        except Exception as e:
            self._log("OTP", "ERROR", "OTP verification exception", str(e))
            self._show_error(str(e))
            self._verify_btn.config(state='normal', text='Verify')

    def _handle_existing_customer(self):
        name = self._name_entry.get().strip()
        email = self._email_entry.get().strip()
        self.cache.set_onboarding_complete()
        self.cache.set('customer_email', email)
        self._status_label.config(text='Customer already exists — opening License Center...', fg=self._primary)
        self._root.update()
        import time as _time
        _time.sleep(1)
        self._result = {
            'name': name, 'email': email,
            'onboarding_complete': True, 'trial_consumed': True,
            'customer_exists': True
        }
        self._root.destroy()

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
                self.cache.set('customer_email', email)
                self._result = {
                    'name': name, 'email': email, 'hardware_id': hardware_id,
                    'onboarding_complete': True, 'trial_started': True
                }
                self._status_label.config(text='Trial activated! You can now use the software.', fg=self._success)
                self._root.after(2000, self._root.destroy)
            else:
                err = trial_result.get('message', trial_result.get('error', ''))
                err_code = trial_result.get('error', {})
                if isinstance(err_code, dict):
                    err_code = err_code.get('code', '')
                if 'TRIAL_ALREADY_CONSUMED' in err or 'already used' in err.lower() or 'PAID_LICENSE_EXISTS' in err or err_code == 'PAID_LICENSE_EXISTS':
                    self.cache.set_onboarding_complete()
                    self.cache.set('customer_email', email)
                    self._status_label.config(text='Customer already exists — continuing...', fg=self._primary)
                    self._root.update()
                    import time as _time
                    _time.sleep(1)
                    self._result = {
                        'name': name, 'email': email, 'hardware_id': hardware_id,
                        'onboarding_complete': True, 'trial_consumed': True,
                        'customer_exists': True
                    }
                    self._root.destroy()
                else:
                    self._show_error(err)
                    self._verify_btn.config(state='normal', text='Verify')
        except Exception as e:
            tb = traceback.format_exc()
            self._log("WELCOME", "ERROR", "Onboarding exception", str(e))
            for tb_line in tb.strip().split("\\n"):
                self._log("WELCOME", "ERROR", f"  {tb_line}")
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
import time
import traceback
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


class LiveLog:
    _entries: list = []
    _external_logger = None

    @classmethod
    def set_external_logger(cls, callback):
        cls._external_logger = callback

    @classmethod
    def log(cls, event: str, detail: str = "") -> None:
        entry = f"[{time.strftime('%H:%M:%S')}] {event}"
        if detail:
            entry += f" — {detail}"
        cls._entries.append(entry)
        print(entry)
        if cls._external_logger:
            try:
                cls._external_logger(event, detail)
            except Exception:
                pass

    @classmethod
    def get_log(cls) -> list:
        return list(cls._entries)

    @classmethod
    def clear(cls) -> None:
        cls._entries = []


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
                 on_license_ready: Optional[Callable[[bool], None]] = None,
                 log_fn: Optional[Callable[[str, str, str, Optional[str]], None]] = None):
        self.config = _load_api_config() if config_path is None else self._load_config(config_path)
        self.hardware = HardwareDetector()
        self.cache = CacheManager(self.config)
        self.client = ApiClient(self.config, self.hardware, self.cache)
        self.engine = LicenseEngine(config_path, on_license_ready=self._on_engine_ready)
        self.on_license_ready = on_license_ready
        self._log_fn = log_fn
        if log_fn:
            def _sdk_log_forwarder(event: str, detail: str = ""):
                log_fn("SDK", "INFO", event, detail)
            LiveLog.set_external_logger(_sdk_log_forwarder)
        self._status: Optional[LicenseStatus] = None
        self._root: Optional[tk.Toplevel] = None
        self._app_unlocked = False
        self._trial_consumed = False

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
        self._company_name = branding.get("company_name", "Your Company")
        self._support_email = branding.get("support_email", "")
        self._sales_email = branding.get("sales_email", "")

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _log(self, category: str, level: str, message: str, detail: Optional[str] = None):
        LiveLog.log(f"[{category}] [{level}] {message}", detail)
        if self._log_fn:
            try:
                self._log_fn(category, level, message, detail)
            except Exception:
                pass

    def _log_error(self, category: str, exc: Exception, context: str = ""):
        tb = traceback.format_exc()
        fname = "universal_license_center.py"
        func = ""
        lineno = 0
        import sys as _sys
        try:
            frame = _sys._getframe(1)
            func = frame.f_code.co_name
            lineno = frame.f_lineno
        except Exception:
            pass
        detail = f"Module: {fname} | Function: {func} | File: {fname} | Line: {lineno} | Exception: {exc}"
        self._log(category, "ERROR", context or str(exc), detail)
        if tb and tb != "NoneType: None\\n":
            for tb_line in tb.strip().split("\\n"):
                self._log(category, "ERROR", f"  {tb_line}")

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
        self._log("WELCOME", "INFO", "License Center started", "Application lock engaged")
        LiveLog.log("License Center started", "Application lock engaged")
        self._lock_application()
        self._log("SDK", "INFO", "Engine initializing", "Starting decision engine")
        LiveLog.log("Engine initializing", "Starting decision engine")
        self._status = self.engine.initialize()
        status = self._status.status if self._status else 'unlicensed'
        self._log("SDK", "INFO", f"Decision engine result: {status}")
        LiveLog.log("Decision engine result", f"Status: {status}")

        if status == 'unlicensed' or (not self._status):
            if not self.cache.is_onboarding_complete():
                self._log("WELCOME", "INFO", "Opening Welcome", "Onboarding required")
                LiveLog.log("Opening Welcome", "Onboarding required")
                result = self._show_welcome()
                if result.get('trial_started'):
                    self._log("WELCOME", "SUCCESS", "Trial started via Welcome")
                    LiveLog.log("Trial started via Welcome")
                    self._status = self.engine.initialize()
                    return {'action': 'trial_started', 'status': self._status.to_dict() if self._status else None}
                if result.get('trial_consumed'):
                    self._log("WELCOME", "INFO", "Existing customer detected", "Trial already consumed — showing license center")
                    LiveLog.log("Existing customer detected", "Trial already consumed — showing license center")
                    self._status = self.engine.initialize()
                    return self._show_license_center(trial_consumed=True)
                if result.get('onboarding_complete'):
                    self._log("WELCOME", "SUCCESS", "Onboarding complete", "Re-initializing engine")
                    LiveLog.log("Onboarding complete", "Re-initializing engine")
                    self._status = self.engine.initialize()
                    return {'action': 'trial_started', 'status': self._status.to_dict() if self._status else None}
                if result.get('skipped') and not result.get('closed'):
                    return {'action': 'skipped', 'locked': True}
                return {'action': 'closed', 'locked': True}

        return self._show_license_center()

    def _show_welcome(self) -> Dict[str, Any]:
        LiveLog.log("Opening Welcome Dialog")
        self._log("WELCOME", "INFO", "Opening Welcome Dialog")
        welcome = WelcomeDialog(
            client=self.client,
            hardware=self.hardware,
            cache=self.cache,
            product_name=self._product_name,
            log_fn=self._log_fn,
        )
        return welcome.show()

    def _show_license_center(self, trial_consumed: bool = False) -> Dict[str, Any]:
        LiveLog.log("Opening Universal License Center",
                     f"Status: {self._status.status if self._status else 'unlicensed'}, "
                     f"trial_consumed={trial_consumed}")
        self._log("WELCOME", "INFO", "Opening Universal License Center",
                   f"Status: {self._status.status if self._status else 'unlicensed'}, trial_consumed={trial_consumed}")
        self._trial_consumed = trial_consumed
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
                "unlocked": self._app_unlocked,
                "trial_consumed": trial_consumed}

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
                ("Renew License", self._renew_license_flow, self._primary),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("View Conversations", self._view_conversations, self._text_secondary),
                ("View Notifications", self._view_notifications, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]
        elif is_paid:
            buttons = [
                ("Renew License", self._renew_license_flow, self._primary),
                ("View Hardware Status", self._view_hardware_status, self._text_secondary),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("Sales Enquiry", self._sales_enquiry, self._text_secondary),
                ("View Conversations", self._view_conversations, self._text_secondary),
                ("View Notifications", self._view_notifications, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]
        elif is_expired:
            buttons = [
                ("Activate License", self._activate_license, self._primary),
                ("Renew License", self._renew_license_flow, self._primary),
                ("Sales Enquiry", self._sales_enquiry, self._text_secondary),
                ("Contact Support", self._contact_support, self._text_secondary),
                ("View Conversations", self._view_conversations, self._text_secondary),
                ("View Notifications", self._view_notifications, self._text_secondary),
                ("Close", self._on_close, "#e5e7eb"),
            ]
        else:
            if self._trial_consumed:
                buttons = [
                    ("Activate License", self._activate_license, self._primary),
                    ("Renew License", self._renew_license_flow, self._primary),
                    ("Sales Enquiry", self._sales_enquiry, self._text_secondary),
                    ("Contact Support", self._contact_support, self._text_secondary),
                    ("Exit", self._on_close, "#e5e7eb"),
                ]
                self._status_detail.config(
                    text="This email has already used its free trial. Please Activate a License or Contact Sales.",
                    fg=self._warning
                )
            else:
                buttons = [
                    ("Start Free Trial", self._start_trial, self._success),
                    ("Activate License", self._activate_license, self._primary),
                    ("Renew License", self._renew_license_flow, self._primary),
                    ("Sales Enquiry", self._sales_enquiry, self._text_secondary),
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
        self._log("WELCOME", "INFO", "Opening Welcome (from Start Free Trial button)")
        LiveLog.log("Opening Welcome (from Start Free Trial button)")
        self._on_close()
        result = self._show_welcome()
        if result.get('trial_started'):
            self._log("WELCOME", "SUCCESS", "Trial started")
            self._status = self.engine.initialize()
            if self._status and self._status.valid:
                self._unlock_application()
                messagebox.showinfo("Trial Started",
                                    "Your free trial has been activated!",
                                    parent=self._root)
        elif result.get('trial_consumed'):
            self._log("WELCOME", "INFO", "Existing customer detected", "Trial already consumed — showing license center")
            LiveLog.log("Existing customer detected", "Trial already consumed — showing license center")
            self._status = self.engine.initialize()
            self._trial_consumed = True
            self._show_license_center(trial_consumed=True)
        elif result.get('closed'):
            self._log("WELCOME", "INFO", "Welcome dialog closed, returning to license center")
            self._show_license_center()

    def _show_restart_prompt(self, parent):
        self._log("UI", "INFO", "Waiting for Restart confirmation")
        restart_win = tk.Toplevel(parent)
        restart_win.title("Restart Required")
        restart_win.geometry("420x200")
        restart_win.configure(bg=self._bg)
        restart_win.transient(parent)
        restart_win.grab_set()

        frame = tk.Frame(restart_win, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Activation completed successfully.",
                 font=("Segoe UI", 12, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        tk.Label(frame, text="The application must now restart to apply your license.",
                 font=("Segoe UI", 10),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=360).pack(anchor="w", padx=16, pady=(0, 16))

        btn_frame = tk.Frame(frame, bg=self._card_bg)
        btn_frame.pack(fill="x", padx=16, pady=(0, 12))

        def restart_now():
            self._log("UI", "INFO", "Restart button clicked")
            self._log("APP", "INFO", "Restart requested")
            self._log("APP", "INFO", "Closing application")
            restart_win.destroy()
            parent.destroy()
            import sys
            sys.exit(0)

        tk.Button(btn_frame, text="Restart Now", command=restart_now,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=16, pady=10, cursor="hand2").pack(side="left", padx=(0, 8))

        tk.Button(btn_frame, text="Restart Later", command=restart_win.destroy,
                  font=("Segoe UI", 11),
                  bg=self._text_secondary, fg="white", relief="flat",
                  padx=16, pady=10, cursor="hand2").pack(side="left")

        restart_win.wait_window()

    def _show_activation_confirmation(self, parent, data, license_key):
        self._log("UI", "INFO", "Creating Activation Success dialog")
        confirm = tk.Toplevel(parent)
        confirm.title("Activation Successful")
        confirm.geometry("500x400")
        confirm.configure(bg=self._bg)
        confirm.transient(parent)
        confirm.grab_set()

        frame = tk.Frame(confirm, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Activation Successful", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._success).pack(anchor="w", padx=16, pady=(12, 8))

        info_items = [
            ("Customer Name", data.get('customer_name', 'N/A')),
            ("Product", self._product_name or data.get('product_name', 'N/A')),
            ("Plan", data.get('plan', 'N/A')),
            ("License Status", "Active"),
            ("Activation Date", data.get('activation_date', 'N/A')),
            ("Expiry Date", data.get('expiry_date', 'N/A')),
            ("Remaining Validity", f"{data.get('days_left', 0)} days"),
        ]

        for label, value in info_items:
            row = tk.Frame(frame, bg=self._card_bg)
            row.pack(fill="x", padx=16, pady=(2, 2))
            tk.Label(row, text=label + ":", font=("Segoe UI", 10, "bold"),
                     bg=self._card_bg, fg=self._text_primary, width=18, anchor="w").pack(side="left")
            tk.Label(row, text=value, font=("Segoe UI", 10),
                     bg=self._card_bg, fg=self._text_secondary, anchor="w").pack(side="left", fill="x")

        tk.Button(frame, text="Continue", command=lambda: [confirm.destroy(), self._show_restart_prompt(parent)],
                  font=("Segoe UI", 11, "bold"),
                  bg=self._primary, fg="white", relief="flat",
                  padx=16, pady=10, cursor="hand2").pack(padx=16, pady=(16, 12))

        confirm.wait_window()

    def _activate_license(self):
        self._log("ACTIVATION", "INFO", "Opening Activation dialog")
        LiveLog.log("Opening Activation", "Dialog displayed")
        dialog = tk.Toplevel(self._root)
        dialog.title("Activate License")
        dialog.geometry("560x620")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Activate License", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        # === PHASE 1: Hardware + License Key + Validate ===
        phase1 = tk.Frame(frame, bg=self._card_bg)
        phase1.pack(fill="x", padx=0, pady=0)

        tk.Label(phase1, text="Hardware ID", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        hw_id = self.hardware.get_fingerprint()
        tk.Label(phase1, text=hw_id[:48], font=("Courier", 9),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=480).pack(anchor="w", padx=16, pady=(0, 8))

        tk.Label(phase1, text="License Key *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        key_var = tk.StringVar()
        key_entry = tk.Entry(phase1, textvariable=key_var, font=("Courier", 11),
                             relief="solid", bd=1)
        key_entry.pack(fill="x", padx=16, pady=(0, 8))

        # === PHASE 2: Customer Info (hidden until validated) ===
        phase2 = tk.Frame(frame, bg=self._card_bg)
        cust_name_lbl = tk.Label(phase2, text="", font=("Segoe UI", 10, "bold"),
                                 bg=self._card_bg, fg=self._text_primary)
        cust_email_lbl = tk.Label(phase2, text="", font=("Segoe UI", 10),
                                  bg=self._card_bg, fg=self._text_secondary)
        cust_plan_lbl = tk.Label(phase2, text="", font=("Segoe UI", 10),
                                 bg=self._card_bg, fg=self._text_secondary)

        # === OTP Section (hidden until validated) ===
        otp_frame = tk.Frame(frame, bg=self._card_bg)
        otp_var = tk.StringVar()

        # === PHASE 3: Activate button ===
        activate_frame = tk.Frame(frame, bg=self._card_bg)

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg)
        status_lbl.pack(padx=16)

        validated = {"key": "", "data": {}, "done": False}
        otp_verified = {"done": False}

        def do_validate():
            if validated["done"]:
                return
            key = key_var.get().strip()
            if not key:
                self._log("VALIDATION", "WARNING", "License key is required")
                status_lbl.config(text="License key is required.", fg=self._error)
                return
            self._log("VALIDATION", "INFO", "Validate button clicked")
            status_lbl.config(text="Validating license...", fg=self._text_secondary)
            dialog.update()
            try:
                self._log("VALIDATION", "INFO", "Validation request started", f"key={key[:8]}...")
                result = self.engine.validate(key)
                self._log("VALIDATION", "INFO", "Validation response received")
                err_data = result.get('error', {})
                err_code = ''
                if isinstance(err_data, dict):
                    err_code = err_data.get('code', '')
                if result.get("success"):
                    self._log("VALIDATION", "SUCCESS", "Validation successful")
                    data = result.get("data", result)
                    validated["key"] = key
                    validated["data"] = data
                    validated["done"] = True

                    # Check if already activated on this device
                    if data.get('this_device_activated'):
                        self._log("VALIDATION", "INFO", "License already activated on this device")
                        status_lbl.config(
                            text="License already activated on this device. You can continue using the application.",
                            fg=self._success)
                        self.cache.set_onboarding_complete()
                        self.cache.save_license_key(key)
                        self.engine._license_key = key
                        self.engine._status = LicenseStatus(
                            valid=True, status='active',
                            expiry_date=data.get('expiry_date'),
                            days_left=data.get('days_left', 0),
                            plan=data.get('plan'), hardware_id=self.hardware.get_fingerprint(),
                            license_key=key,
                            customer_name=data.get('customer_name'),
                            customer_email=data.get('customer_email'),
                            customer_phone=data.get('customer_phone'),
                            customer_mobile=data.get('customer_mobile'),
                            message='License active'
                        )
                        self.engine._cache.set_license_status(self.engine._status.to_dict())
                        self.engine._cache.mark_has_ever_activated_paid_license()
                        self._unlock_application()
                        self._status = self.engine.get_status()
                        self._refresh_display()
                        dialog.after(2000, dialog.destroy)
                        return

                    # Check device limit
                    active_devices = data.get('active_devices', 0)
                    max_devices = data.get('max_devices', 999)
                    if active_devices >= max_devices:
                        self._log("VALIDATION", "WARNING", f"Device limit reached ({active_devices}/{max_devices})")
                        status_lbl.config(
                            text=f"Device limit reached ({active_devices}/{max_devices}). Please deactivate another device or contact support.",
                            fg=self._error)
                        return

                    # Lock key entry
                    key_entry.config(state="disabled")

                    # Show customer info
                    tk.Label(phase2, text="Customer", font=("Segoe UI", 10, "bold"),
                             bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
                    cust_name_lbl.config(text=data.get('customer_name', 'N/A'))
                    cust_name_lbl.pack(anchor="w", padx=16, pady=(0, 2))
                    cust_email_lbl.config(text=data.get('customer_email', 'N/A'))
                    cust_email_lbl.pack(anchor="w", padx=16, pady=(0, 2))
                    plan_info = f"Product: {data.get('product_name', 'N/A')} | Plan: {data.get('plan', 'N/A')} | Status: {data.get('status', 'N/A')} | Expires: {data.get('expiry_date', 'N/A')} | Days Left: {data.get('days_left', 0)}"
                    cust_plan_lbl.config(text=plan_info)
                    cust_plan_lbl.pack(anchor="w", padx=16, pady=(0, 8))

                    sep_valid = tk.Frame(phase2, bg=self._border, height=1)
                    sep_valid.pack(fill="x", padx=16, pady=(4, 8))

                    phase2.pack(fill="x", padx=0, pady=0)
                    validate_btn.pack_forget()
                    dialog.geometry("560x620")

                    # Show OTP section
                    tk.Label(otp_frame, text="OTP Verification", font=("Segoe UI", 11, "bold"),
                             bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(8, 4))
                    email = data.get('customer_email', '')
                    tk.Label(otp_frame, text=f"OTP sent to: {email}",
                             font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
                        anchor="w", padx=16, pady=(0, 8))
                    tk.Label(otp_frame, text="OTP Code", font=("Segoe UI", 10, "bold"),
                             bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
                    tk.Entry(otp_frame, textvariable=otp_var, font=("Courier", 11),
                             relief="solid", bd=1, width=16).pack(anchor="w", padx=16, pady=(0, 8))

                    sep_otp = tk.Frame(otp_frame, bg=self._border, height=1)
                    sep_otp.pack(fill="x", padx=16, pady=(4, 8))

                    otp_frame.pack(fill="x", padx=0, pady=0)
                    otp_btn_frame.pack(fill="x", padx=16, pady=(4, 8))

                    self._on_send_otp_inline(email, status_lbl)
                else:
                    err_msg = "Validation failed"
                    err_data = result.get('error', result)
                    if isinstance(err_data, dict):
                        err_msg = err_data.get('message', err_msg)
                    self._log("VALIDATION", "ERROR", f"Validation failed: {err_code}", err_msg)
                    if err_code == 'LICENSE_EXPIRED':
                        status_lbl.config(text="License has expired. Please renew your license.", fg=self._error)
                    elif err_code == 'LICENSE_REVOKED':
                        status_lbl.config(text="License has been revoked. Please contact support.", fg=self._error)
                    elif err_code == 'LICENSE_INACTIVE':
                        status_lbl.config(text="License is inactive. Please contact support.", fg=self._error)
                    elif err_code == 'LICENSE_DELETED':
                        status_lbl.config(text="License has been deleted. Please contact support.", fg=self._error)
                    else:
                        status_lbl.config(text=f"Validation failed: {err_msg}", fg=self._error)
            except Exception as e:
                self._log_error("VALIDATION", e, "Validation exception")
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        validate_btn = tk.Button(phase1, text="Validate License", command=do_validate,
                                 font=("Segoe UI", 11, "bold"),
                                 bg=self._primary, fg="white", relief="flat",
                                 padx=16, pady=10, cursor="hand2")
        validate_btn.pack(fill="x", padx=16, pady=(8, 12))

        def do_send_otp():
            email = validated["data"].get('customer_email', '')
            self._log("OTP", "INFO", "Sending activation OTP (manual resend)", email)
            self._on_send_otp_inline(email, status_lbl)

        def do_verify_otp():
            if otp_verified["done"]:
                return
            otp = otp_var.get().strip()
            if not otp:
                self._log("OTP", "WARNING", "OTP code is required")
                status_lbl.config(text="OTP code is required.", fg=self._error)
                return
            email = validated["data"].get('customer_email', '')
            if not email:
                self._log("OTP", "ERROR", "No customer email available for OTP verification")
                status_lbl.config(text="No customer email available.", fg=self._error)
                return
            self._log("OTP", "INFO", "OTP verification started", f"email={email}")
            status_lbl.config(text="Verifying OTP...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.client.verify_otp(email, otp)
                if result.get("success"):
                    self._log("OTP", "SUCCESS", "OTP verified successfully", f"email={email}")
                    otp_verified["done"] = True
                    status_lbl.config(text="OTP verified. You may now activate.", fg=self._success)
                    send_otp_btn.config(state="disabled")
                    verify_otp_btn.config(state="disabled")

                    # Show activate button
                    activate_frame.pack(fill="x", padx=0, pady=0)
                    activate_btn.pack(fill="x", padx=16, pady=(8, 12))
                else:
                    err = result.get('error', result.get('message', 'Verification failed'))
                    if isinstance(err, dict):
                        err = err.get('message', str(err))
                    self._log("OTP", "ERROR", "OTP verification failed", str(err))
                    status_lbl.config(text=f"OTP verification failed: {err}", fg=self._error)
            except Exception as e:
                self._log_error("OTP", e, "OTP verification exception")
                status_lbl.config(text=f"OTP error: {str(e)}", fg=self._error)

        otp_btn_frame = tk.Frame(otp_frame, bg=self._card_bg)
        send_otp_btn = tk.Button(otp_btn_frame, text="Send OTP", command=do_send_otp,
                                 font=("Segoe UI", 11, "bold"),
                                 bg=self._primary, fg="white", relief="flat",
                                 padx=16, pady=10, cursor="hand2")
        send_otp_btn.pack(side="left", padx=(0, 8))
        verify_otp_btn = tk.Button(otp_btn_frame, text="Verify OTP", command=do_verify_otp,
                                   font=("Segoe UI", 11, "bold"),
                                   bg=self._primary, fg="white", relief="flat",
                                   padx=16, pady=10, cursor="hand2")
        verify_otp_btn.pack(side="left")

        def do_activate():
            if not otp_verified["done"]:
                self._log("ACTIVATION", "WARNING", "Activate clicked but OTP not verified")
                status_lbl.config(text="Please verify OTP before activating.", fg=self._error)
                return
            key = validated["key"]
            self._log("ACTIVATION", "INFO", "Activation request started")
            status_lbl.config(text="Activating license...", fg=self._text_secondary)
            dialog.update()
            try:
                self._log("ACTIVATION", "INFO", "Waiting for API response")
                result = self.engine.activate(key)
                self._log("ACTIVATION", "INFO", "API response received")
                if result.get("success"):
                    if result.get('already_activated'):
                        self._log("ACTIVATION", "INFO", "Already activated on this device")
                        status_lbl.config(
                            text="License already activated on this device. You can continue using the application.",
                            fg=self._success)
                        dialog.after(2000, dialog.destroy)
                        return
                    self._log("ACTIVATION", "SUCCESS", "Activation successful")
                    data = result.get("data", result)
                    data["customer_name"] = validated["data"].get("customer_name", "")
                    data["customer_email"] = validated["data"].get("customer_email", "")
                    self._status = self.engine.get_status()
                    self._refresh_display()
                    self._unlock_application()
                    dialog.destroy()
                    self._log("UI", "INFO", "Creating Activation Success dialog")
                    self._show_activation_confirmation(self._root, data, key)
                else:
                    err_data = result.get('error', {})
                    err_code = ''
                    if isinstance(err_data, dict):
                        err_code = err_data.get('code', '')
                    err = result.get("message", result.get("error", "Unknown error"))
                    self._log("ACTIVATION", "ERROR", f"Activation failed: {err_code}", err)
                    if err_code == 'MAX_DEVICES_EXCEEDED':
                        status_lbl.config(text="Device limit reached. Please deactivate another device or contact support.", fg=self._error)
                    elif err_code == 'LICENSE_EXPIRED':
                        status_lbl.config(text="License has expired. Please renew your license.", fg=self._error)
                    elif err_code == 'LICENSE_REVOKED':
                        status_lbl.config(text="License has been revoked. Please contact support.", fg=self._error)
                    elif err_code == 'LICENSE_INACTIVE':
                        status_lbl.config(text="License is inactive. Please contact support.", fg=self._error)
                    elif result.get('already_activated'):
                        status_lbl.config(text="License already activated on this device.", fg=self._success)
                    else:
                        status_lbl.config(text=f"Activation failed: {err}", fg=self._error)
            except Exception as e:
                self._log_error("ACTIVATION", e, "Activation exception")
                status_lbl.config(text=f"Activation error: {str(e)}", fg=self._error)

        activate_btn = tk.Button(activate_frame, text="Activate License", command=do_activate,
                                 font=("Segoe UI", 11, "bold"),
                                 bg=self._success, fg="white", relief="flat",
                                 padx=16, pady=10, cursor="hand2")

        dialog.wait_window()

    def _on_send_otp_inline(self, email, status_lbl):
        if not email:
            self._log("OTP", "ERROR", "No customer email available for OTP")
            status_lbl.config(text="No customer email available for OTP.", fg=self._error)
            return
        self._log("OTP", "INFO", "Sending activation OTP", f"email={email}")
        status_lbl.config(text="Sending OTP...", fg=self._text_secondary)
        status_lbl.update()
        try:
            result = self.client.send_otp(email)
            if result.get("success"):
                self._log("OTP", "SUCCESS", "OTP sent successfully", f"email={email}")
                status_lbl.config(text=f"OTP sent to {email}. Enter code below.", fg=self._success)
            else:
                err = result.get('error', result.get('message', 'Failed to send OTP'))
                if isinstance(err, dict):
                    err = err.get('message', str(err))
                self._log("OTP", "ERROR", "OTP send failed", str(err))
                status_lbl.config(text=f"OTP send failed: {err}", fg=self._error)
        except Exception as e:
            self._log_error("OTP", e, "OTP send exception")
            status_lbl.config(text=f"OTP error: {str(e)}", fg=self._error)

    def _renew_license_flow(self):
        self._log("RENEWAL", "INFO", "Opening Renewal dialog")
        LiveLog.log("Opening Renewal", "Dialog displayed")
        dialog = tk.Toplevel(self._root)
        dialog.title("Renew License")
        dialog.geometry("620x700")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text="Renew License", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))

        # Phase 1: Enter License Key
        phase1 = tk.Frame(frame, bg=self._card_bg)
        phase1.pack(fill="x", padx=0, pady=0)

        tk.Label(phase1, text="Enter Last License Key *", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        key_var = tk.StringVar()
        tk.Entry(phase1, textvariable=key_var, font=("Courier", 11),
                 relief="solid", bd=1).pack(fill="x", padx=16, pady=(0, 8))

        status_lbl = tk.Label(frame, text="", font=("Segoe UI", 9), bg=self._card_bg, wraplength=540)
        status_lbl.pack(padx=16, pady=(4, 0))

        # Phase 2: Customer Info (hidden until validated)
        info_frame = tk.Frame(frame, bg=self._card_bg)

        # Phase 3: Plan Selection (hidden until validated)
        plan_frame = tk.Frame(frame, bg=self._card_bg)
        selected_plan = tk.StringVar()
        validated_data: Dict[str, Any] = {}

        def do_validate():
            key = key_var.get().strip()
            if not key:
                status_lbl.config(text="License key is required.", fg=self._error)
                return
            status_lbl.config(text="Validating license...", fg=self._text_secondary)
            dialog.update()
            try:
                validate_result = self.engine.validate(key)
                if not validate_result.get('success') and validate_result.get('valid') is not True:
                    data = validate_result.get('data', validate_result)
                    err_code = validate_result.get('error', {}).get('code', '') or data.get('error', {}).get('code', '')
                    err_msg = validate_result.get('error', {}).get('message', '') or validate_result.get('message', '')
                    if err_code in ('LICENSE_REVOKED', 'LICENSE_INACTIVE', 'LICENSE_DELETED'):
                        status_lbl.config(text=f"License {err_code.replace('LICENSE_', '').lower()}. Contact support.", fg=self._error)
                        return
                    if err_code != 'LICENSE_EXPIRED':
                        status_lbl.config(text=f"Validation failed: {err_msg}", fg=self._error)
                        return
                    status_lbl.config(text="License expired. Proceeding with renewal...", fg=self._warning)
                else:
                    status_lbl.config(text="License valid. Loading information...", fg=self._success)
                dialog.update()

                validated_data.clear()
                validated_data.update(validate_result.get('data', validate_result))

                # Show customer/license info
                phase1.pack_forget()
                info_frame.pack(fill="x", padx=0, pady=8)

                info_fields = [
                    ("Customer Name", validated_data.get('customer_name', 'N/A')),
                    ("Email", validated_data.get('customer_email', 'N/A')),
                    ("Product", validated_data.get('product_name', 'N/A')),
                    ("Current Plan", validated_data.get('plan', 'N/A')),
                    ("Current Expiry", validated_data.get('expiry_date', 'N/A')),
                    ("License Status", validated_data.get('status', 'N/A')),
                    ("Days Remaining", str(validated_data.get('days_left', 0))),
                ]
                for label, value in info_fields:
                    row = tk.Frame(info_frame, bg=self._card_bg)
                    row.pack(fill="x", padx=16, pady=(1, 1))
                    tk.Label(row, text=label + ":", font=("Segoe UI", 10, "bold"),
                             bg=self._card_bg, fg=self._text_primary, width=18, anchor="w").pack(side="left")
                    tk.Label(row, text=value, font=("Segoe UI", 10),
                             bg=self._card_bg, fg=self._text_secondary, anchor="w").pack(side="left", fill="x")

                # Load plans
                status_lbl.config(text="Loading available plans...", fg=self._text_secondary)
                dialog.update()
                try:
                    plans_result = self.client.get_available_plans(key)
                    plans = []
                    if plans_result.get('success') and plans_result.get('plans'):
                        plans = plans_result['plans']
                except Exception:
                    plans = []

                if plans:
                    plan_frame.pack(fill="x", padx=0, pady=8)
                    for widget in plan_frame.winfo_children():
                        widget.destroy()

                    tk.Label(plan_frame, text="Available Paid Plans", font=("Segoe UI", 11, "bold"),
                             bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 6))

                    plan_buttons = []
                    for plan in plans:
                        rb = tk.Radiobutton(plan_frame, text=f"{plan.get('name', 'N/A')} - {plan.get('description', plan.get('duration', ''))}",
                                            variable=selected_plan, value=plan.get('name', ''),
                                            font=("Segoe UI", 10), bg=self._card_bg,
                                            anchor="w", wraplength=480)
                        rb.pack(fill="x", padx=32, pady=(2, 2))
                        plan_buttons.append(rb)

                    keep_rb = tk.Radiobutton(plan_frame, text="Keep current plan",
                                             variable=selected_plan, value=validated_data.get('plan', ''),
                                             font=("Segoe UI", 10), bg=self._card_bg,
                                             anchor="w", wraplength=480)
                    keep_rb.pack(fill="x", padx=32, pady=(2, 6))
                    plan_buttons.append(keep_rb)
                else:
                    tk.Label(plan_frame, text="No alternative plans available. Current plan will be renewed.",
                             font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary).pack(
                        anchor="w", padx=16, pady=(4, 8))

                # Show Send button
                send_btn.pack(fill="x", padx=16, pady=(8, 12))

            except Exception as e:
                self._log_error("RENEWAL", e, "Renewal validation exception")
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        def do_send():
            key = key_var.get().strip()
            status_lbl.config(text="Sending renewal request...", fg=self._text_secondary)
            dialog.update()
            try:
                result = self.engine.create_communication(
                    category='renewal',
                    customer_email=validated_data.get('customer_email', ''),
                    customer_name=validated_data.get('customer_name', ''),
                    subject=f"License Renewal Request - {key}",
                    message=f"Renewal requested for license {key}.",
                    license_key=key,
                    hardware_id=self.hardware.get_fingerprint(),
                )
                if result.get('success'):
                    messagebox.showinfo("Request Submitted",
                                        "Your renewal request has been submitted.\\nOur team will contact you.",
                                        parent=dialog)
                    dialog.destroy()
                elif result.get('queued'):
                    messagebox.showinfo("Request Queued",
                                        "Your renewal request has been queued.\\nIt will be sent when connection is restored.",
                                        parent=dialog)
                    dialog.destroy()
                else:
                    err = result.get('message', result.get('error', 'Failed'))
                    status_lbl.config(text=f"Failed: {err}", fg=self._error)
            except Exception as e:
                self._log_error("RENEWAL", e, "Renewal send exception")
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        validate_btn = tk.Button(frame, text="Validate License", command=do_validate,
                                 font=("Segoe UI", 11, "bold"),
                                 bg=self._primary, fg="white", relief="flat",
                                 padx=16, pady=10, cursor="hand2")
        validate_btn.pack(fill="x", padx=16, pady=(8, 4))

        send_btn = tk.Button(frame, text="Submit Renewal Request", command=do_send,
                             font=("Segoe UI", 11, "bold"),
                             bg=self._success, fg="white", relief="flat",
                             padx=16, pady=10, cursor="hand2")

        dialog.wait_window()

    def _reactivate_license(self):
        self._log("ACTIVATION", "INFO", "Opening Reactivation dialog")
        LiveLog.log("Opening Reactivation", "Dialog displayed")
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
                self._log_error("ACTIVATION", e, "Reactivation send exception")
                status_lbl.config(text=f"Error: {str(e)}", fg=self._error)

        tk.Button(frame, text="Submit Reactivation Request", command=do_send,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._warning, fg="white", relief="flat",
                  padx=16, pady=10, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _view_hardware_status(self):
        hw_id = self.hardware.get_fingerprint()
        dialog = tk.Toplevel(self._root)
        dialog.title("Hardware Status")
        dialog.geometry("500x350")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()
        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)
        tk.Label(frame, text="Hardware Status", font=("Segoe UI", 16, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(12, 8))
        tk.Label(frame, text="Current Hardware ID:", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        tk.Label(frame, text=hw_id, font=("Courier", 9),
                 bg=self._card_bg, fg=self._text_secondary,
                 wraplength=420).pack(anchor="w", padx=16, pady=(0, 4))
        cached_hw = None
        cached = self.cache.get_license_status()
        if cached and cached.get('hardware_id'):
            cached_hw = cached.get('hardware_id')
        if cached_hw:
            match = hw_id == cached_hw
            tk.Label(frame, text="Registered Hardware ID:", font=("Segoe UI", 10, "bold"),
                     bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
            tk.Label(frame, text=cached_hw, font=("Courier", 9),
                     bg=self._card_bg, fg=self._text_secondary,
                     wraplength=420).pack(anchor="w", padx=16, pady=(0, 4))
            status_color = self._success if match else self._warning
            status_text = "Matched" if match else "Mismatched"
            tk.Label(frame, text=f"Status: {status_text}", font=("Segoe UI", 10, "bold"),
                     bg=self._card_bg, fg=status_color).pack(anchor="w", padx=16, pady=(4, 8))
        else:
            tk.Label(frame, text="No registered hardware found.",
                     font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary,
                     wraplength=420).pack(anchor="w", padx=16, pady=(4, 8))
        tk.Label(frame, text="Hardware replacement requires administrator approval.",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary,
                 wraplength=420).pack(anchor="w", padx=16, pady=(8, 4))
        tk.Label(frame, text="Please use Contact Support to request a hardware change.",
                 font=("Segoe UI", 10), bg=self._card_bg, fg=self._text_secondary,
                 wraplength=420).pack(anchor="w", padx=16, pady=(0, 12))
        tk.Button(frame, text="Close", command=dialog.destroy,
                  font=("Segoe UI", 11, "bold"),
                  bg=self._text_secondary, fg="white", relief="flat",
                  padx=16, pady=8, cursor="hand2").pack(padx=16, pady=(8, 12))
        dialog.wait_window()

    def _contact_support(self):
        self._show_communication_dialog('support', 'Contact Support')

    def _sales_enquiry(self):
        self._show_communication_dialog('sales', 'Sales Enquiry')

    def _show_communication_dialog(self, category: str, title: str):
        dialog = tk.Toplevel(self._root)
        dialog.title(title)
        dialog.geometry("520x480")
        dialog.configure(bg=self._bg)
        dialog.transient(self._root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                         highlightbackground=self._border)
        frame.pack(fill="both", expand=True, padx=20, pady=20)

        tk.Label(frame, text=title, font=("Segoe UI", 16, "bold"),
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

        tk.Label(frame, text="Subject", font=("Segoe UI", 10, "bold"),
                 bg=self._card_bg, fg=self._text_primary).pack(anchor="w", padx=16, pady=(4, 2))
        subject_var = tk.StringVar(value=title)
        tk.Entry(frame, textvariable=subject_var, font=("Segoe UI", 11),
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
            subject = subject_var.get().strip()
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
                result = self.engine.create_communication(
                    category=category,
                    customer_email=email,
                    customer_name=name,
                    subject=subject,
                    message=msg,
                    license_key=license_key or '',
                    hardware_id=self.hardware.get_fingerprint(),
                    sdk_version=SDK_VERSION,
                    runtime_type=RUNTIME_TYPE,
                )
                if result.get("success") or result.get("queued"):
                    messagebox.showinfo("Request Submitted",
                                        "Your request has been sent.\\n"
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
                  padx=16, pady=10, cursor="hand2").pack(fill="x", padx=16, pady=(8, 12))

        dialog.wait_window()

    def _view_conversations(self):
        if not self._status:
            return
        email = self._status.customer_email or ''
        if not email:
            cached = self.cache.get_license_status() or {}
            email = cached.get('customer_email', '')
        if not email:
            messagebox.showwarning("No Email", "No customer email found.",
                                    parent=self._root)
            return
        try:
            result = self.engine.list_conversations(email)
            if result.get("success"):
                conversations = result.get("data", {}).get("conversations", [])
                if not conversations:
                    messagebox.showinfo("Conversations",
                                        "No conversations found.",
                                        parent=self._root)
                    return
                dialog = tk.Toplevel(self._root)
                dialog.title("Your Conversations")
                dialog.geometry("600x500")
                dialog.configure(bg=self._bg)
                dialog.transient(self._root)
                dialog.grab_set()

                frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                                 highlightbackground=self._border)
                frame.pack(fill="both", expand=True, padx=16, pady=16)

                tk.Label(frame, text="Your Conversations",
                         font=("Segoe UI", 14, "bold"),
                         bg=self._card_bg, fg=self._text_primary).pack(
                    anchor="w", padx=12, pady=(8, 12))

                list_frame = tk.Frame(frame, bg=self._card_bg)
                list_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

                canvas = tk.Canvas(list_frame, bg=self._card_bg,
                                   highlightthickness=0)
                scrollbar = tk.Scrollbar(list_frame, orient="vertical",
                                          command=canvas.yview)
                scrollable = tk.Frame(canvas, bg=self._card_bg)

                scrollable.bind(
                    "<Configure>",
                    lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
                )
                canvas.create_window((0, 0), window=scrollable, anchor="nw")
                canvas.configure(yscrollcommand=scrollbar.set)
                canvas.pack(side="left", fill="both", expand=True)
                scrollbar.pack(side="right", fill="y")

                for conv in conversations:
                    conv_frame = tk.Frame(scrollable, bg=self._card_bg,
                                          bd=1, relief="solid",
                                          highlightbackground=self._border)
                    conv_frame.pack(fill="x", pady=(0, 6), padx=4)

                    tk.Label(conv_frame,
                             text=f"{conv.get('category', '').upper()} - {conv.get('subject', 'No Subject')}",
                             font=("Segoe UI", 11, "bold"),
                             bg=self._card_bg, fg=self._text_primary).pack(
                        anchor="w", padx=10, pady=(6, 2))
                    tk.Label(conv_frame,
                             text=f"Status: {conv.get('status', 'N/A')}  |  "
                                  f"{conv.get('created_at', '')[:10]}",
                             font=("Segoe UI", 9),
                             bg=self._card_bg, fg=self._text_secondary).pack(
                        anchor="w", padx=10, pady=(0, 6))

                tk.Button(frame, text="Close", command=dialog.destroy,
                          font=("Segoe UI", 11, "bold"),
                          bg=self._primary, fg="white", relief="flat",
                          padx=16, pady=10, cursor="hand2").pack(
                    padx=12, pady=(0, 12))
            else:
                messagebox.showerror("Error",
                                     "Failed to load conversations.",
                                     parent=self._root)
        except Exception as e:
            messagebox.showerror("Error",
                                 f"Failed to load conversations: {str(e)}",
                                 parent=self._root)

    def _view_notifications(self):
        if not self._status:
            return
        email = self._status.customer_email or ''
        if not email:
            cached = self.cache.get_license_status() or {}
            email = cached.get('customer_email', '')
        if not email:
            return
        try:
            result = self.engine.get_notifications(email)
            if result.get("success"):
                notifications = result.get("data", {}).get("notifications", [])
                if not notifications:
                    messagebox.showinfo("Notifications",
                                        "No notifications found.",
                                        parent=self._root)
                    return
                dialog = tk.Toplevel(self._root)
                dialog.title("Notifications")
                dialog.geometry("550x450")
                dialog.configure(bg=self._bg)
                dialog.transient(self._root)
                dialog.grab_set()

                frame = tk.Frame(dialog, bg=self._card_bg, bd=1, relief="solid",
                                 highlightbackground=self._border)
                frame.pack(fill="both", expand=True, padx=16, pady=16)

                tk.Label(frame, text="Notifications",
                         font=("Segoe UI", 14, "bold"),
                         bg=self._card_bg, fg=self._text_primary).pack(
                    anchor="w", padx=12, pady=(8, 12))

                list_frame = tk.Frame(frame, bg=self._card_bg)
                list_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

                canvas = tk.Canvas(list_frame, bg=self._card_bg,
                                   highlightthickness=0)
                scrollbar = tk.Scrollbar(list_frame, orient="vertical",
                                          command=canvas.yview)
                scrollable = tk.Frame(canvas, bg=self._card_bg)

                scrollable.bind(
                    "<Configure>",
                    lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
                )
                canvas.create_window((0, 0), window=scrollable, anchor="nw")
                canvas.configure(yscrollcommand=scrollbar.set)
                canvas.pack(side="left", fill="both", expand=True)
                scrollbar.pack(side="right", fill="y")

                for notif in notifications:
                    nf = tk.Frame(scrollable, bg=self._card_bg,
                                  bd=1, relief="solid",
                                  highlightbackground=self._border)
                    nf.pack(fill="x", pady=(0, 6), padx=4)
                    read_status = "" if notif.get("is_read") else " (NEW)"
                    tk.Label(nf,
                             text=f"{notif.get('category', '').upper()}{read_status}",
                             font=("Segoe UI", 10, "bold"),
                             bg=self._card_bg, fg=self._text_primary).pack(
                        anchor="w", padx=10, pady=(4, 0))
                    tk.Label(nf,
                             text=notif.get('title', ''),
                             font=("Segoe UI", 10),
                             bg=self._card_bg, fg=self._text_secondary).pack(
                        anchor="w", padx=10, pady=(0, 4))

                tk.Button(frame, text="Close", command=dialog.destroy,
                          font=("Segoe UI", 11, "bold"),
                          bg=self._primary, fg="white", relief="flat",
                          padx=16, pady=10, cursor="hand2").pack(
                    padx=12, pady=(0, 12))
        except Exception:
            pass
`,
  };
};
