package widgets

import (
	"fmt"

	"github.com/websmith/sdk"
)

type Dashboard struct {
	engine    *wsd.LicenseEngine
	status    string
	daysLeft  int
	expiry    string
	plan      string
}

func NewDashboard(engine *wsd.LicenseEngine) *Dashboard {
	return &Dashboard{
		engine: engine,
	}
}

func (d *Dashboard) Render() string {
	d.Refresh()
	output := ""
	output += fmt.Sprintf("License Status: %s\n", d.status)
	if d.daysLeft > 0 {
		output += fmt.Sprintf("Days Remaining: %d\n", d.daysLeft)
	}
	if d.expiry != "" {
		output += fmt.Sprintf("Expiry: %s\n", d.expiry)
	}
	if d.plan != "" {
		output += fmt.Sprintf("Plan: %s\n", d.plan)
	}
	return output
}

func (d *Dashboard) Refresh() {
	s := d.engine.GetStatus()
	if s == nil {
		s = d.engine.Initialize()
	}
	if s != nil && s.Valid && (s.Status == "active" || s.Status == "trial" || s.Status == "trial_active") {
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

func (d *Dashboard) GetStatus() string {
	return d.status
}

func (d *Dashboard) GetDaysLeft() int {
	return d.daysLeft
}

func (d *Dashboard) GetExpiry() string {
	return d.expiry
}

func (d *Dashboard) GetPlan() string {
	return d.plan
}
