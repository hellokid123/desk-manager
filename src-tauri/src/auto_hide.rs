use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Manager;

const EDGE_MARGIN: i32 = 8;
const HIDE_STRIP: i32 = 6;
const TRIGGER_ZONE: i32 = 60;
const HIDE_DELAY_MS: u64 = 100;
const CHECK_INTERVAL_MS: u64 = 100;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HiddenEdge {
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Debug, Default)]
pub struct AutoHideState {
    pub is_auto_hidden: bool,
    pub hidden_edge: Option<HiddenEdge>,
    pub normal_bounds: Option<(i32, i32, u32, u32)>, // x, y, width, height
    pub hide_delay_started: Option<std::time::Instant>,
    pub user_dragging: bool,
}

fn get_cursor_position() -> Option<(i32, i32)> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut point = POINT::default();
        unsafe {
            if GetCursorPos(&mut point).is_ok() {
                return Some((point.x, point.y));
            }
        }
    }
    None
}

pub fn start_auto_hide(app_handle: tauri::AppHandle, state: Arc<Mutex<AutoHideState>>) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_millis(CHECK_INTERVAL_MS));
            run_check(&app_handle, &state);
        }
    });
}

fn run_check(app_handle: &tauri::AppHandle, state: &Arc<Mutex<AutoHideState>>) {
    let Some(window) = app_handle.get_webview_window("main") else {
        return;
    };

    let Ok(win_pos) = window.outer_position() else { return };
    let Ok(win_size) = window.outer_size() else { return };
    let Some(monitor) = window.current_monitor().ok().flatten() else { return };
    let Some((mx, my)) = get_cursor_position() else { return };

    let monitor_size = monitor.size();
    let screen_w = monitor_size.width as i32;
    let screen_h = monitor_size.height as i32;

    let mut st = state.lock().unwrap();

    // === 已隐藏状态：检查鼠标是否进入触发区 ===
    if st.is_auto_hidden {
        if let Some(edge) = st.hidden_edge {
            let in_zone = match edge {
                HiddenEdge::Right => mx >= screen_w - TRIGGER_ZONE,
                HiddenEdge::Left => mx <= TRIGGER_ZONE,
                HiddenEdge::Top => my <= TRIGGER_ZONE,
                HiddenEdge::Bottom => my >= screen_h - TRIGGER_ZONE,
            };

            if in_zone {
                // 展开窗口
                if let Some((x, y, w, h)) = st.normal_bounds {
                    let _ = window.set_min_size(Some(tauri::PhysicalSize::new(1u32, 1u32)));
                    let _ = window.set_max_size(None::<tauri::PhysicalSize<u32>>);
                    let _ = window.set_size(tauri::PhysicalSize::new(w, h));
                    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                    // 恢复正常约束
                    let _ = window.set_min_size(Some(tauri::PhysicalSize::new(350u32, 500u32)));
                }
                st.is_auto_hidden = false;
                st.hidden_edge = None;
                st.normal_bounds = None;
            }
        }
        return;
    }

    // === 正常状态：检查是否需要隐藏 ===
    if st.user_dragging {
        st.hide_delay_started = None;
        return;
    }

    // Windows Snap Layout 检测：最大化或窗口占屏幕较大比例时不隐藏
    if window.is_maximized().unwrap_or(false) {
        st.hide_delay_started = None;
        return;
    }
    let snap_ratio = win_size.width as f64 / monitor_size.width as f64;
    if snap_ratio >= 0.4 {
        st.hide_delay_started = None;
        return;
    }

    let bx = win_pos.x;
    let by = win_pos.y;
    let bw = win_size.width as i32;
    let bh = win_size.height as i32;

    let at_right = bx + bw >= screen_w - EDGE_MARGIN;
    let at_left = bx <= EDGE_MARGIN;
    let at_top = by <= EDGE_MARGIN;
    let at_bottom = by + bh >= screen_h - EDGE_MARGIN;
    let at_any_edge = at_right || at_left || at_top || at_bottom;

    if !at_any_edge {
        st.hide_delay_started = None;
        return;
    }

    // 鼠标在窗口内则不隐藏
    let in_window = mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
    if in_window {
        st.hide_delay_started = None;
        return;
    }

    // 开始延迟计时
    match st.hide_delay_started {
        None => {
            st.hide_delay_started = Some(std::time::Instant::now());
        }
        Some(start) => {
            if start.elapsed() >= Duration::from_millis(HIDE_DELAY_MS) {
                // 执行隐藏
                st.normal_bounds = Some((bx, by, bw as u32, bh as u32));
                st.hide_delay_started = None;

                // 先移除尺寸约束
                let _ = window.set_min_size(Some(tauri::PhysicalSize::new(1u32, 1u32)));
                let _ = window.set_max_size(None::<tauri::PhysicalSize<u32>>);

                if at_right {
                    st.hidden_edge = Some(HiddenEdge::Right);
                    let _ = window.set_position(tauri::PhysicalPosition::new(
                        screen_w - HIDE_STRIP,
                        by,
                    ));
                    let _ = window.set_size(tauri::PhysicalSize::new(
                        HIDE_STRIP as u32,
                        bh as u32,
                    ));
                } else if at_left {
                    st.hidden_edge = Some(HiddenEdge::Left);
                    let _ = window.set_position(tauri::PhysicalPosition::new(0, by));
                    let _ = window.set_size(tauri::PhysicalSize::new(
                        HIDE_STRIP as u32,
                        bh as u32,
                    ));
                } else if at_top {
                    st.hidden_edge = Some(HiddenEdge::Top);
                    let _ = window.set_position(tauri::PhysicalPosition::new(bx, 0));
                    let _ = window.set_size(tauri::PhysicalSize::new(
                        bw as u32,
                        HIDE_STRIP as u32,
                    ));
                } else if at_bottom {
                    st.hidden_edge = Some(HiddenEdge::Bottom);
                    let _ = window.set_position(tauri::PhysicalPosition::new(
                        bx,
                        screen_h - HIDE_STRIP,
                    ));
                    let _ = window.set_size(tauri::PhysicalSize::new(
                        bw as u32,
                        HIDE_STRIP as u32,
                    ));
                }

                st.is_auto_hidden = true;
            }
        }
    }
}
