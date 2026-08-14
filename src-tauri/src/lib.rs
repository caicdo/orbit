//! Rust side of Orbit.
//!
//! The UI is a plain web app, so there is very little here on purpose. Add
//! `#[tauri::command]` functions below and list them in `invoke_handler` when you
//! need something the browser cannot do (filesystem, notifications, menu items).

/// Example command — call from the UI with:
/// `import { invoke } from "@tauri-apps/api/core"; await invoke("app_version")`
#[tauri::command]
fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![app_version])
        .run(tauri::generate_context!())
        .expect("error while running Orbit");
}
