pub mod activation_button;
pub mod dashboard_widget;
pub mod settings_widget;
pub mod status_widget;

pub use activation_button::ActivationButton;
pub use dashboard_widget::DashboardWidget;
pub use settings_widget::SettingsWidget;
pub use status_widget::StatusWidget;

use crate::license_engine::LicenseEngine;

pub trait Widget {
    fn refresh(&mut self);
    fn render(&mut self) -> String;
}

pub struct WidgetManager {
    pub dashboard: DashboardWidget,
    pub settings: SettingsWidget,
    pub status: StatusWidget,
    pub activation: ActivationButton,
}

impl WidgetManager {
    pub fn new(engine: &mut LicenseEngine) -> Self {
        Self {
            dashboard: DashboardWidget::new(engine),
            settings: SettingsWidget::new(engine),
            status: StatusWidget::new(engine),
            activation: ActivationButton,
        }
    }

    pub fn refresh_all(&mut self) {
        self.dashboard.refresh();
        self.settings.refresh();
        self.status.refresh();
    }

    pub fn render_all(&mut self) -> String {
        let mut output = String::new();
        output.push_str("=== Dashboard ===\n");
        output.push_str(&self.dashboard.render());
        output.push_str("\n=== Status ===\n");
        output.push_str(&self.status.get_status_line());
        output.push_str("\n=== Info ===\n");
        output.push_str(&self.settings.render_info());
        let active = if ActivationButton::is_active_dynamic() {
            "active"
        } else {
            "inactive"
        };
        output.push_str(&format!("Activation: {}\n", active));
        output
    }

    pub fn get_manager_info(&self) -> String {
        format!(
            "WidgetManager with {} widgets: dashboard, settings, status, activation",
            4
        )
    }
}
