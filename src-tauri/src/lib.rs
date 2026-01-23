// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//
use duckdb::{Connection, types::Value};
use serde::Serialize;
use serde_json::json;

// This is the data structure we send back to React.
#[derive(Serialize)]
pub struct TableSchema {
    columns: Vec<String>,
    column_types: Vec<String>,
    row_count_estimate: usize,
}

// Result structure for SQL query execution
#[derive(Serialize)]
pub struct QueryResult {
    columns: Vec<String>,
    column_types: Vec<String>,
    rows: Vec<Vec<serde_json::Value>>,
    row_count: usize,
}


#[tauri::command]
async fn get_csv_schema(path: String) -> Result<TableSchema, String> {
    //  1. Open a temporary in-memory DuckDB connection
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    let query = format!("DESCRIBE (SELECT * FROM read_csv_auto('{}'));", path);

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

#[tauri::command]
async fn execute_sql(query: String, file_path: String, table_name: String) -> Result<QueryResult, String> {
    // Open in-memory DuckDB connection
    let conn = Connection::open_in_memory().map_err(|e| e.to_string())?;

    // Register the CSV file as a table with the given name
    let create_view = format!(
        "CREATE VIEW {} AS SELECT * FROM read_csv_auto('{}');",
        table_name, file_path
    );
    conn.execute(&create_view, []).map_err(|e| e.to_string())?;

    // Execute the user's query
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // Get column information
    let column_count = stmt.column_count();
    let columns: Vec<String> = (0..column_count)
        .map(|i| stmt.column_name(i).map(|s| s.to_string()).unwrap_or_else(|_| "unknown".to_string()))
        .collect();

    // Execute and collect rows
    let mut rows: Vec<Vec<serde_json::Value>> = Vec::new();
    let mut result_rows = stmt.query([]).map_err(|e| e.to_string())?;

    // Collect column types from first row (we'll fill this in)
    let mut column_types: Vec<String> = vec!["unknown".to_string(); column_count];

    while let Some(row) = result_rows.next().map_err(|e| e.to_string())? {
        let mut row_data: Vec<serde_json::Value> = Vec::new();

        for i in 0..column_count {
            let value: Value = row.get(i).unwrap_or(Value::Null);
            let json_value = match &value {
                Value::Null => serde_json::Value::Null,
                Value::Boolean(b) => json!(*b),
                Value::TinyInt(n) => json!(*n),
                Value::SmallInt(n) => json!(*n),
                Value::Int(n) => json!(*n),
                Value::BigInt(n) => json!(*n),
                Value::HugeInt(n) => json!(n.to_string()),
                Value::UTinyInt(n) => json!(*n),
                Value::USmallInt(n) => json!(*n),
                Value::UInt(n) => json!(*n),
                Value::UBigInt(n) => json!(*n),
                Value::Float(f) => json!(*f),
                Value::Double(d) => json!(*d),
                Value::Text(s) => json!(s),
                Value::Blob(b) => json!(format!("[blob: {} bytes]", b.len())),
                _ => json!(format!("{:?}", value)),
            };

            // Update column type based on value
            if rows.is_empty() {
                column_types[i] = match &value {
                    Value::Null => "NULL".to_string(),
                    Value::Boolean(_) => "BOOLEAN".to_string(),
                    Value::TinyInt(_) | Value::SmallInt(_) | Value::Int(_) | Value::BigInt(_) => "INTEGER".to_string(),
                    Value::HugeInt(_) => "HUGEINT".to_string(),
                    Value::UTinyInt(_) | Value::USmallInt(_) | Value::UInt(_) | Value::UBigInt(_) => "UINTEGER".to_string(),
                    Value::Float(_) | Value::Double(_) => "DOUBLE".to_string(),
                    Value::Text(_) => "VARCHAR".to_string(),
                    Value::Blob(_) => "BLOB".to_string(),
                    _ => "UNKNOWN".to_string(),
                };
            }

            row_data.push(json_value);
        }
        rows.push(row_data);
    }

    let row_count = rows.len();

    Ok(QueryResult {
        columns,
        column_types,
        rows,
        row_count,
    })
}

// Ensure the command is registered
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_csv_schema, execute_sql])   // Register here!
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
