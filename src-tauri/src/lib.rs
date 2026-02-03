pub mod commands;
pub mod db;
pub mod error;

use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            commands::update_row,
            commands::delete_row,
            commands::execute_query,
            // Utility commands
            commands::get_database_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
