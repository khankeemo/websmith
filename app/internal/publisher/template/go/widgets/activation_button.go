package widgets

import (
	"fmt"

	"github.com/websmith/sdk"
)

type ActivationButtonWidget struct {
	engine  *wsd.LicenseEngine
	label   string
	enabled bool
}

func NewActivationButtonWidget(engine *wsd.LicenseEngine) *ActivationButtonWidget {
	return &ActivationButtonWidget{
		engine:  engine,
		label:   "Activate License",
		enabled: true,
	}
}

func (w *ActivationButtonWidget) Click() {
	if !w.enabled {
		fmt.Println("Activation button is disabled.")
		return
	}
	fmt.Println("Opening activation dialog for license activation...")
	status := w.engine.GetStatus()
	productName := ""
	if status != nil {
		productName = status.Message
	}
	dialog := wsd.NewActivationDialog(w.engine, productName)
	result := dialog.Show()
	if result != nil {
		if activated, ok := result["activated"].(bool); ok && activated {
			w.label = "Licensed"
			fmt.Println("License activated successfully via button click.")
			w.enabled = false
		} else {
			fmt.Println("License activation was cancelled or failed.")
		}
	}
}

func (w *ActivationButtonWidget) GetLabel() string {
	if w.label != "" {
		return w.label
	}
	return "Activate License"
}

func (w *ActivationButtonWidget) IsEnabled() bool {
	return w.enabled
}

func (w *ActivationButtonWidget) SetEnabled(enabled bool) {
	w.enabled = enabled
}

func (w *ActivationButtonWidget) SetLabel(label string) {
	w.label = label
}

func (w *ActivationButtonWidget) Reset() {
	w.label = "Activate License"
	w.enabled = true
}
