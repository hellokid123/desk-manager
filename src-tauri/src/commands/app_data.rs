use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileCard {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardContainer {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub cards: Vec<FileCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub time: String,
    pub description: String,
    pub completed: bool,
    pub deleted: bool,
    #[serde(default)]
    pub order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub transparency: f64,
    pub is_locked: bool,
    pub containers: Vec<CardContainer>,
    pub todos: Vec<Todo>,
    pub file_manager_height: f64,
    pub window_size: WindowSize,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            transparency: 0.0,
            is_locked: false,
            containers: vec![CardContainer {
                id: "1".to_string(),
                name: "文件区 1".to_string(),
                cards: vec![],
            }],
            todos: vec![],
            file_manager_height: 50.0,
            window_size: WindowSize {
                width: 350.0,
                height: 700.0,
            },
        }
    }
}

fn get_data_file_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("desk-manager")
        .join("data");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("appdata.json")
}

#[command]
pub fn load_app_data() -> AppData {
    let path = get_data_file_path();
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => match serde_json::from_str::<AppData>(&content) {
                Ok(data) => return data,
                Err(e) => {
                    log::error!("Failed to parse app data: {}", e);
                }
            },
            Err(e) => {
                log::error!("Failed to read app data: {}", e);
            }
        }
    }
    AppData::default()
}

#[command]
pub fn save_app_data(data: AppData) -> bool {
    let path = get_data_file_path();
    match serde_json::to_string_pretty(&data) {
        Ok(json) => match fs::write(&path, json) {
            Ok(_) => true,
            Err(e) => {
                log::error!("Failed to write app data: {}", e);
                false
            }
        },
        Err(e) => {
            log::error!("Failed to serialize app data: {}", e);
            false
        }
    }
}
