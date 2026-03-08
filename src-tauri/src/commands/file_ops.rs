use std::fs;
use std::path::Path;
use tauri::command;

#[command]
pub fn is_directory(file_path: String) -> bool {
    match fs::metadata(&file_path) {
        Ok(metadata) => metadata.is_dir(),
        Err(_) => false,
    }
}

#[command]
pub fn open_path(file_path: String) -> Result<(), String> {
    if file_path.is_empty() {
        return Err("Empty path".to_string());
    }
    if !Path::new(&file_path).exists() {
        return Err(format!("Path does not exist: {}", file_path));
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
