package widgets

import (
	"fmt"

	"github.com/websmith/sdk"
)

type Settings struct {
	engine *wsd.LicenseEngine
}

func NewSettings(engine *wsd.LicenseEngine) *Settings {
	return &Settings{engine: engine}
}

func (s *Settings) RenderInfo() string {
	s.Refresh()
	output := ""
	st := s.engine.GetStatus()
	cfg := s.engine.GetLicenseKey()
	if st != nil {
		output += fmt.Sprintf("Status: %s\n", st.Status)
	}
	if name := s.engine.GetStatus(); name != nil {
		output += fmt.Sprintf("Hardware ID: %s\n", name.HardwareID)
	}
	if st != nil {
		if st.ExpiresAt != "" {
			output += fmt.Sprintf("Expiry: %s\n", st.ExpiresAt)
		}
		if st.Plan != "" {
			output += fmt.Sprintf("Plan: %s\n", st.Plan)
		}
	}
	if cfg != "" {
		output += fmt.Sprintf("License Key: %s\n", cfg)
	}
	return output
}

func (s *Settings) Refresh() {
	s.engine.Initialize()
}

func (s *Settings) OpenActivation() {
	dialog := wsd.NewActivationDialog(s.engine, "")
	dialog.Show()
	s.Refresh()
}

func (s *Settings) OpenRenewal() {
	key := s.engine.GetLicenseKey()
	if key != "" {
		dialog := wsd.NewRenewalDialog(s.engine, key)
		dialog.Show()
		s.Refresh()
	}
}

func (s *Settings) OpenReplace() {
	key := s.engine.GetLicenseKey()
	if key != "" {
		dialog := wsd.NewDeviceReplaceDialog(s.engine, key)
		dialog.Show()
		s.Refresh()
	}
}

func (s *Settings) OpenWelcome() {
	dialog := wsd.NewWelcomeDialog(s.engine, "")
	dialog.Show()
	s.Refresh()
}
