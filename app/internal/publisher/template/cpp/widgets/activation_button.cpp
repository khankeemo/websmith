// Activation Button Widget - standalone component
// Provides a single-button interface for launching the activation dialog.
// When clicked, it opens the ActivationDialog which guides the user through
// hardware detection, customer info entry, license key input, and activation.
// On success, the button text updates to "Licensed" to reflect the new state.
//
// This widget reads branding labels and colors from the engine config.
// Labels used: activate_license_btn, licensed_text
// Colors used: primary (button), success (licensed state)

#include "../widgets.h"
#include "../license_engine.h"
#include "../activation.h"
#include "../client.h"
#include "../hardware.h"
#include "../cache.h"
#include "../crypto.h"
#include <iostream>
#include <memory>

// Factory function to create and show activation button
void show_activation_button(std::shared_ptr<LicenseEngine> engine) {
    ActivationButton btn(engine);
    btn.build();
    std::cout << "  Press Enter to activate license or 'q' to quit: ";
    std::string input;
    std::getline(std::cin, input);
    if (input != "q" && input != "Q") {
        btn.click();
    }
}
