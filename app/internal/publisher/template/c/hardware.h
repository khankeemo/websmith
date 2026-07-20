#ifndef WSD_HARDWARE_H
#define WSD_HARDWARE_H

#include "crypto.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    char fingerprint[65];
    JsonMap* identifiers;
    int initialized;
} HardwareDetector;

HardwareDetector* wsd_hardware_new(void);
void wsd_hardware_free(HardwareDetector* hw);
const char* wsd_get_fingerprint(HardwareDetector* hw);
JsonMap* wsd_get_identifiers(HardwareDetector* hw);

#ifdef __cplusplus
}
#endif

#endif
