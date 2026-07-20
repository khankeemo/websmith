#ifndef WSD_WIDGETS_H
#define WSD_WIDGETS_H

#include "license_engine.h"

#ifdef __cplusplus
extern "C" {
#endif

void wsd_dashboard_show(LicenseEngine* engine);
void wsd_settings_show(LicenseEngine* engine);
void wsd_status_show(LicenseEngine* engine);
void wsd_activation_button_show(LicenseEngine* engine);

#ifdef __cplusplus
}
#endif

#endif
