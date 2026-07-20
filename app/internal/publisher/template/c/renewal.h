#ifndef WSD_RENEWAL_H
#define WSD_RENEWAL_H

#include "crypto.h"
#include "license_engine.h"

#ifdef __cplusplus
extern "C" {
#endif

JsonMap* wsd_renewal_show(LicenseEngine* engine, const char* license_key);

#ifdef __cplusplus
}
#endif

#endif
