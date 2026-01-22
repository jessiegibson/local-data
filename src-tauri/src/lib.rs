// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//
use duckdb::Connection;
use serde::{Deserialize, Serialize};

// This is the data structure we send back to React.
#[derive(Serialize)]

pub struct TableSchema {
    columns: Vec<String>,
    column_types: Vec<String>,
    row_count_estimate: usize,
}


#[tauri::command]
async fn get_csv_schema(path: String) -> Result<TableSchema, String> {
    //  1. Open a temporary in-memory DuckDB connection
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    let query = format!("DESCRIBE SELECT * FROM read_csv_auto('{}' LIMIT 1", path);

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // 3. Extract the column names
    let rows = stmt.query_map([], |row| {
        Ok((
                row.get::<_, String>(0)?,   // column_name
                row.get::<_, String>(1)?,   // column_type
        ))
    }).map_err(|e| e.to_string())?;

    let mut columns = Vec::new();
    let mut types = Vec::new();

    for row in rows {
        let (name, col_type) = row.unwrap();
        columns.push(name);
        types.push(col_type);
    }

    Ok(TableSchema {
        columns,
        column_types: types,
        row_count_estimate: 0,  // We can add count logic later
    })
}

// Ensure the command is registered
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_csv_schema])   // Register here!
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
