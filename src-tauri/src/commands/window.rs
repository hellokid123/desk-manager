use std::sync::Mutex;
use tauri::{command, AppHandle, Manager};

pub struct LockState(pub Mutex<bool>);

#[command]
pub fn toggle_lock(
    app: AppHandle,
    lock_state: tauri::State<'_, LockState>,
) -> bool {
    let mut locked = lock_state.0.lock().unwrap();
    *locked = !*locked;
    let is_locked = *locked;

    if let Some(window) = app.get_webview_window("main") {
        if is_locked {
            if let Ok(size) = window.inner_size() {
                let _ = window.set_resizable(false);
                let _ = window.set_min_size(Some(tauri::LogicalSize::new(
                    size.width as f64,
                    size.height as f64,
                )));
                let _ = window.set_max_size(Some(tauri::LogicalSize::new(
                    size.width as f64,
                    size.height as f64,
                )));
            }
        } else {
            let _ = window.set_resizable(true);
            let _ = window.set_min_size(Some(tauri::LogicalSize::new(350.0, 500.0)));
            let _ = window.set_max_size(None::<tauri::LogicalSize<f64>>);
        }
    }

    is_locked
}

#[command]
pub fn get_lock_state(lock_state: tauri::State<'_, LockState>) -> bool {
    *lock_state.0.lock().unwrap()
}

#[command]
pub fn close_app(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

#[command]
pub fn show_notification(app: AppHandle, title: String, body: String) {
    use tauri_plugin_notification::NotificationExt;
    let _ = app
        .notification()
        .builder()
        .title(&title)
        .body(&body)
        .show();
}

#[command]
pub fn save_window_size(app: AppHandle) -> Option<(f64, f64)> {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(size) = window.inner_size() {
            return Some((size.width as f64, size.height as f64));
        }
    }
    None
}
