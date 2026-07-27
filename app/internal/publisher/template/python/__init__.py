"""{{PRODUCT_NAME}} SDK - Universal License Center"""
__version__ = "{{SDK_VERSION}}"
__all__ = [
    "UniversalLicenseCenter",
    "WelcomeDialog",
    "SuccessDialog",
    "RestartDialog",
    "LicenseEngine", "LicenseStatus",
    "ApiClient", "ApiError",
    "HardwareDetector",
    "CacheManager",
    "LiveLog",
]

from .client import ApiClient, ApiError
from .license_engine import LicenseEngine, LicenseStatus
from .hardware import HardwareDetector
from .cache import CacheManager
from .welcome import WelcomeDialog
from .live_log import LiveLog
from .universal_license_center import UniversalLicenseCenter
from .universal_success_dialog import SuccessDialog
from .universal_restart_dialog import RestartDialog

from . import activation
from . import renewal
from . import reactivation
from . import trial
from . import communication
from . import notifications
from . import support
from . import sales
from . import config
