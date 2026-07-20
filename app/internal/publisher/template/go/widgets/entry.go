package widgets

import (
	"github.com/websmith/sdk"
)

type DashboardWidget struct {
	engine   *wsd.LicenseEngine
	status   string
	daysLeft int
	expiry   string
	plan     string
}

type SettingsWidget struct {
	engine *wsd.LicenseEngine
}

type StatusWidget struct {
	engine *wsd.LicenseEngine
	label  string
	color  string
}

type ActivationButton struct {
	engine *wsd.LicenseEngine
	label  string
}

func NewDashboardWidget(engine *wsd.LicenseEngine) *DashboardWidget {
	return &DashboardWidget{
		engine: engine,
	}
}

func NewSettingsWidget(engine *wsd.LicenseEngine) *SettingsWidget {
	return &SettingsWidget{engine: engine}
}

func NewStatusWidget(engine *wsd.LicenseEngine) *StatusWidget {
	return &StatusWidget{
		engine: engine,
		label:  "Checking...",
		color:  "gray",
	}
}

func NewActivationButton(engine *wsd.LicenseEngine) *ActivationButton {
	return &ActivationButton{
		engine: engine,
		label:  "Activate License",
	}
}

func (d *DashboardWidget) Render() string {
	d.Refresh()
	output := "License Status: " + d.status + "\n"
	if d.daysLeft > 0 {
		output += "Days Remaining: " + string(rune(d.daysLeft+'0')) + "\n"
	}
	if d.expiry != "" {
		output += "Expiry: " + d.expiry + "\n"
	}
	if d.plan != "" {
		output += "Plan: " + d.plan + "\n"
	}
	return output
}

func (d *DashboardWidget) Refresh() {
	s := d.engine.GetStatus()
	if s == nil {
		s = d.engine.Initialize()
	}
	if s != nil && s.Valid {
		d.status = "Active"
		if s.TrialActive {
			d.status = "Trial Active"
		}
		d.daysLeft = s.DaysRemaining
		d.expiry = s.ExpiresAt
		d.plan = s.Plan
	} else {
		d.status = "Unlicensed"
		d.daysLeft = 0
		d.expiry = ""
		d.plan = ""
	}
}

func (s *SettingsWidget) RenderInfo() string {
	s.Refresh()
	output := ""
	st := s.engine.GetStatus()
	lk := s.engine.GetLicenseKey()
	if st != nil {
		output += "Status: " + st.Status + "\n"
		output += "Hardware ID: " + st.HardwareID + "\n"
		if st.ExpiresAt != "" {
			output += "Expiry: " + st.ExpiresAt + "\n"
		}
		if st.Plan != "" {
			output += "Plan: " + st.Plan + "\n"
		}
	}
	if lk != "" {
		output += "License Key: " + lk + "\n"
	}
	return output
}

func (s *SettingsWidget) Refresh() {
	s.engine.Initialize()
}

func (s *SettingsWidget) OpenActivation() {
	dialog := wsd.NewActivationDialog(s.engine, "")
	dialog.Show()
	s.Refresh()
}

func (s *StatusWidget) GetStatusLine() string {
	s.Refresh()
	st := s.engine.GetStatus()
	if st == nil {
		return "No license"
	}
	if st.Valid {
		if st.TrialActive {
			return "Trial: " + string(rune(st.DaysRemaining+'0')) + "d"
		}
		return "Licensed: " + string(rune(st.DaysRemaining+'0')) + "d"
	}
	if st.Message != "" {
		return st.Message
	}
	return "No license"
}

func (s *StatusWidget) Refresh() {
	st := s.engine.GetStatus()
	if st == nil {
		st = s.engine.Initialize()
	}
	if st != nil && st.Valid {
		if st.TrialActive {
			s.label = "Trial Active"
			s.color = "yellow"
		} else {
			s.label = "Licensed"
			s.color = "green"
		}
	} else {
		if st != nil && st.Message != "" {
			s.label = st.Message
		} else {
			s.label = "No license"
		}
		s.color = "red"
	}
}

func (b *ActivationButton) Click() {
	dialog := wsd.NewActivationDialog(b.engine, b.engine.GetStatus().Message)
	result := dialog.Show()
	if result != nil {
		if activated, ok := result["activated"].(bool); ok && activated {
			b.label = "Licensed"
		}
	}
}

func (b *ActivationButton) GetLabel() string {
	if b.label != "" {
		return b.label
	}
	return "Activate License"
}
