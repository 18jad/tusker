pub mod commands;
pub mod db;
pub mod error;

use commands::AppState;
use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Create keyboard shortcuts menu item
            let keyboard_shortcuts = MenuItemBuilder::new("Keyboard Shortcuts")
                .id("keyboard_shortcuts")
                .accelerator("CmdOrCtrl+/")
                .build(app)?;

            // Create Help submenu
            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&keyboard_shortcuts)
                .build()?;

            // Get the default menu and add our Help submenu to it
            let menu = Menu::default(app.handle())?;
            menu.append(&help_menu)?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "keyboard_shortcuts" {
                let _ = app.emit("show-keyboard-shortcuts", ());
            }
        })
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // Connection commands
            commands::connect,
            commands::connect_saved,
            commands::disconnect,
            commands::disconnect_all,
            commands::test_connection,
            commands::list_active_connections,
            commands::is_connected,
            // Saved connections commands
            commands::get_saved_connections,
            commands::save_connection,
            commands::delete_saved_connection,
            commands::get_saved_password,
            commands::save_password,
            commands::delete_password,
            // Schema commands
            commands::get_schemas,
            commands::get_tables,
            commands::get_columns,
            commands::get_row_count,
            commands::get_indexes,
            commands::get_constraints,
            // Data commands
            commands::fetch_table_data,
            commands::insert_row,
            commands::bulk_insert,
            commands::update_row,
            commands::delete_row,
            commands::execute_query,
            // Utility commands
            commands::get_database_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
