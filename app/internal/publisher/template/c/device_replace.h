#ifndef WSD_DEVICE_REPLACE_H
#define WSD_DEVICE_REPLACE_H

#include "crypto.h"
#include "license_engine.h"

#ifdef __cplusplus
extern "C" {
#endif

JsonMap* wsd_device_replace_show(LicenseEngine* engine, const char* license_key);

#ifdef __cplusplus
}
#endif

#endif
