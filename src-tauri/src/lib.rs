mod auto_hide;
mod commands;
mod protocol;

use auto_hide::AutoHideState;
use commands::window::LockState;
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let auto_hide_state = Arc::new(Mutex::new(AutoHideState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup({
            let state = auto_hide_state.clone();
            move |app| {
                if cfg!(debug_assertions) {
                    app.handle().plugin(
                        tauri_plugin_log::Builder::default()
                            .level(log::LevelFilter::Info)
                            .build(),
                    )?;
                }

                // 监听窗口移动事件，约束窗口位置 + 标记拖拽状态
                if let Some(window) = app.get_webview_window("main") {
                    let win = window.clone();
                    let move_state = state.clone();
                    window.on_window_event(move |event| {
                        match event {
                            tauri::WindowEvent::Moved(_) => {
                                let is_hidden = {
                                    let st = move_state.lock().unwrap();
                                    st.is_auto_hidden
                                };
                                // 自动隐藏时不约束位置
                                if !is_hidden {
                                    // 标记正在拖拽，防止自动隐藏
                                    {
                                        let mut st = move_state.lock().unwrap();
                                        st.user_dragging = true;
                                    }
                                    constrain_window_position(&win);
                                }
                            }
                            tauri::WindowEvent::Resized(_) => {
                                // 拖拽结束后延迟清除 dragging 标记
                                let drag_state = move_state.clone();
                                std::thread::spawn(move || {
                                    std::thread::sleep(std::time::Duration::from_millis(200));
                                    let mut st = drag_state.lock().unwrap();
                                    st.user_dragging = false;
                                });
                            }
                            _ => {}
                        }
                    });
                }

                // 启动自动隐藏检测定时器
                auto_hide::start_auto_hide(app.handle().clone(), state.clone());

                // 移动结束后延迟清除 dragging 标记（用额外线程）
                let drag_clear_state = state.clone();
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // 定期清除 user_dragging 标记
                    // 这是因为 Moved 事件只在移动时触发，结束后没有事件
                    loop {
                        std::thread::sleep(std::time::Duration::from_millis(200));
                        let Some(_window) = handle.get_webview_window("main") else {
                            continue;
                        };
                        // 通过检查窗口是否仍在被移动来判断拖拽是否结束
                        // 简单方案：每次移动设置 dragging=true，200ms 后设置 false
                        // 如果在 200ms 内又发生移动，dragging 会被重新设为 true
                        let mut st = drag_clear_state.lock().unwrap();
                        if st.user_dragging {
                            st.user_dragging = false;
                        }
                        drop(st);
                    }
                });

                Ok(())
            }
        })
        .manage(LockState(Mutex::new(false)))
        .register_uri_scheme_protocol("file-icon", |_ctx, request| {
            let uri = request.uri().to_string();
            let file_path = extract_file_path_from_uri(&uri);

            if let Some(ref path) = file_path {
                if let Some(png_data) = protocol::get_file_icon_png(path) {
                    return tauri::http::Response::builder()
                        .status(200)
                        .header("Content-Type", "image/png")
                        .body(png_data)
                        .unwrap();
                }
            }

            let empty_png = create_empty_png();
            tauri::http::Response::builder()
                .status(200)
                .header("Content-Type", "image/png")
                .body(empty_png)
                .unwrap()
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_data::load_app_data,
            commands::app_data::save_app_data,
            commands::file_ops::is_directory,
            commands::file_ops::open_path,
            commands::window::toggle_lock,
            commands::window::get_lock_state,
            commands::window::close_app,
            commands::window::show_notification,
            commands::window::save_window_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn constrain_window_position(window: &tauri::WebviewWindow) {
    let Ok(pos) = window.outer_position() else { return };
    let Ok(size) = window.outer_size() else { return };
    let Some(monitor) = window.current_monitor().ok().flatten() else { return };

    let monitor_pos = monitor.position();
    let monitor_size = monitor.size();

    let screen_x = monitor_pos.x;
    let screen_y = monitor_pos.y;
    let screen_w = monitor_size.width as i32;
    let screen_h = monitor_size.height as i32;
    let win_w = size.width as i32;
    let win_h = size.height as i32;

    let mut new_x = pos.x;
    let mut new_y = pos.y;

    if new_x < screen_x {
        new_x = screen_x;
    }
    if new_y < screen_y {
        new_y = screen_y;
    }
    if new_x + win_w > screen_x + screen_w {
        new_x = screen_x + screen_w - win_w;
    }
    if new_y + win_h > screen_y + screen_h {
        new_y = screen_y + screen_h - win_h;
    }

    if new_x != pos.x || new_y != pos.y {
        let _ = window.set_position(tauri::PhysicalPosition::new(new_x, new_y));
    }
}

fn extract_file_path_from_uri(uri: &str) -> Option<String> {
    let stripped = uri
        .strip_prefix("file-icon://localhost/")
        .or_else(|| uri.strip_prefix("file-icon:///"))
        .or_else(|| uri.strip_prefix("file-icon://"))?;

    let decoded = percent_decode(stripped);
    if decoded.is_empty() {
        return None;
    }
    Some(decoded)
}

fn percent_decode(input: &str) -> String {
    let mut result = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                &input[i + 1..i + 3],
                16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&result).to_string()
}

fn create_empty_png() -> Vec<u8> {
    let img = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 0]));
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png).unwrap();
    buf.into_inner()
}
