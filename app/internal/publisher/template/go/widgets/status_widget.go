package widgets

import (
	"fmt"

	"github.com/websmith/sdk"
)

type Status struct {
	engine  *wsd.LicenseEngine
	label   string
	color   string
}

func NewStatus(engine *wsd.LicenseEngine) *Status {
	return &Status{
		engine: engine,
	}
}

func (s *Status) Render() string {
	s.Refresh()
	return fmt.Sprintf("%s: %s", s.label, s.color)
}

func (s *Status) GetStatusLine() string {
	s.Refresh()
	st := s.engine.GetStatus()
	if st == nil {
		return "No license"
	}
	if st.Valid {
		if st.TrialActive {
			return fmt.Sprintf("Trial: %dd", st.DaysRemaining)
		}
		return fmt.Sprintf("Licensed: %dd", st.DaysRemaining)
	}
	if st.Message != "" {
		return st.Message
	}
	return "No license"
}

func (s *Status) Refresh() {
	st := s.engine.GetStatus()
	if st == nil {
		st = s.engine.Initialize()
	}
	if st != nil && st.Valid {
		if st.TrialActive {
			s.label = fmt.Sprintf("Trial: %dd", st.DaysRemaining)
			s.color = "yellow"
		} else {
			s.label = fmt.Sprintf("Licensed: %dd", st.DaysRemaining)
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

func (s *Status) IsActive() bool {
	s.Refresh()
	return s.color == "green" || s.color == "yellow"
}
