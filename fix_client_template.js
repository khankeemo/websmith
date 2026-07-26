const fs = require('fs');
let content = fs.readFileSync('app/internal/publisher/runtimes/python.ts', 'utf-8');

// Find the client.py template - it starts at 'client.py': \`"""API Client for ${context.productName} License API"""
const startMarker = "'client.py': `\"\"\"API Client for ${context.productName} License API\"\"\"";
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.log('Start marker not found');
    process.exit(1);
}

// Find the end of this template - look for `,\n\n    'crypto.py'
const searchStart = startIdx + startMarker.length;
const endMarker = "`,\n\n    'crypto.py'";
const endIdx = content.indexOf(endMarker, searchStart);
if (endIdx === -1) {
    console.log('End marker not found');
    process.exit(1);
}

// Extract the template content
const templateContent = content.substring(searchStart, endIdx);

// Fix indentation in the template
let fixedTemplate = templateContent;

// Fix ApiError class
fixedTemplate = fixedTemplate.replace(
    /class ApiError\(Exception\):\n    def __init__\(self, status_code: int, message: str, data: Optional\[Dict\[str, Any\]\] = None\):/g,
    'class ApiError(Exception):\n    def __init__(\n        self,\n        status_code: int,\n        message: str,\n        data: Optional[Dict[str, Any]] = None\n    ):'
);

// Fix ApiClient __init__ method
fixedTemplate = fixedTemplate.replace(
    /class ApiClient:\n    def __init__\(\n        self,\n        config: Dict\[str, Any\],\n        hardware: Optional\[HardwareDetector\] = None,\n        cache: Optional\[CacheManager\] = None\n    \):/g,
    'class ApiClient:\n    def __init__(\n        self,\n        config: Dict[str, Any],\n        hardware: Optional[HardwareDetector] = None,\n        cache: Optional[CacheManager] = None,\n    ):'
);

// Fix _sign_request method
fixedTemplate = fixedTemplate.replace(
    /def _sign_request\(self, payload: Dict\[str, Any\],\n                       method: str = 'POST',\n                       path: str = '',\n                       query: str = ''\) -> Dict\[str, str\]:/g,
    "def _sign_request(\n        self,\n        payload: Dict[str, Any],\n        method: str = 'POST',\n        path: str = '',\n        query: str = '',\n    ) -> Dict[str, str]:"
);

// Fix send_request method signature
fixedTemplate = fixedTemplate.replace(
    /def send_request\(self, request_type: str, customer_name: str, customer_email: str,\n                     subject: str = '', message: str = '',\n                     license_key: str = '', hardware_id: str = '',\n                     plan_name: str = '', product_name: str = '',\n                     customer_mobile: str = '', current_plan_id: str = '',\n                     current_plan_name: str = '', requested_plan_id: str = '',\n                     requested_plan_name: str = ''\) -> Dict\[str, Any\]:/g,
    `def send_request(
        self,
        request_type: str,
        customer_name: str,
        customer_email: str,
        subject: str = '',
        message: str = '',
        license_key: str = '',
        hardware_id: str = '',
        plan_name: str = '',
        product_name: str = '',
        customer_mobile: str = '',
        current_plan_id: str = '',
        current_plan_name: str = '',
        requested_plan_id: str = '',
        requested_plan_name: str = '',
    ) -> Dict[str, Any]:`
);

// Fix register_customer
fixedTemplate = fixedTemplate.replace(
    /def register_customer\(self, name: str, email: str, mobile: str,\n                           country_code: str, hardware_id: str,\n                           company_name: str = ''\) -> Dict\[str, Any\]:/g,
    `def register_customer(
        self,
        name: str,
        email: str,
        mobile: str,
        country_code: str,
        hardware_id: str,
        company_name: str = '',
    ) -> Dict[str, Any]:`
);

// Fix convert_trial
fixedTemplate = fixedTemplate.replace(
    /def convert_trial\(self, hardware_id: Optional\[str\] = None, plan: Optional\[str\] = None, customer_name: str = '', customer_email: str = ''\) -> Dict\[str, Any\]:/g,
    `def convert_trial(
        self,
        hardware_id: Optional[str] = None,
        plan: Optional[str] = None,
        customer_name: str = '',
        customer_email: str = '',
    ) -> Dict[str, Any]:`
);

// Fix bind_device
fixedTemplate = fixedTemplate.replace(
    /def bind_device\(self, license_key: str, hardware_id: Optional\[str\] = None, device_name: Optional\[str\] = None\) -> Dict\[str, Any\]:/g,
    `def bind_device(
        self,
        license_key: str,
        hardware_id: Optional[str] = None,
        device_name: Optional[str] = None,
    ) -> Dict[str, Any]:`
);

// Fix verify_license_for_renewal
fixedTemplate = fixedTemplate.replace(
    /def verify_license_for_renewal\(self, license_key: str\) -> Dict\[str, Any\]:/g,
    `def verify_license_for_renewal(self, license_key: str) -> Dict[str, Any]:`
);

// Replace the template
const newContent = content.substring(0, searchStart) + fixedTemplate + content.substring(endIdx);
fs.writeFileSync('app/internal/publisher/runtimes/python.ts', newContent);
console.log('Fixed client.py template');