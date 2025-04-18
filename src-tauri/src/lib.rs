use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ApiConfig {
    host: String,
    port: u16,
    password: String,
    #[serde(default = "default_true")]
    players_section_enabled: bool,
    #[serde(default = "default_poll_rate")]
    player_list_poll_rate_seconds: Option<u32>,
}

fn default_true() -> bool {
    true
}

fn default_poll_rate() -> Option<u32> {
    Some(30)
}

#[derive(Serialize, Deserialize, Debug)]
struct ApiResponse<T> {
    data: Option<T>,
    message: String,
    succeeded: bool,
}

#[derive(Serialize, Deserialize, Debug)]
struct Player {
    name: String,
    unique_id: String,
}

type PlayerListData = std::collections::HashMap<String, Player>;

#[derive(Serialize, Deserialize, Debug)]
struct PlayerCountData {
    num_players: i32,
}

#[derive(Serialize, Deserialize, Debug)]
struct ChatMessagePayload {
    message: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct KickPlayerPayload {
    unique_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct BanPlayerPayload {
    unique_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct UnbanPlayerPayload {
    unique_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct BannedPlayer {
    name: String,
    unique_id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct BanListData {
    #[serde(flatten)]
    banned_players: std::collections::HashMap<String, BannedPlayer>,
}

fn get_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.join("api_config.json"))
        .map_err(|e| format!("Failed to resolve application data directory: {}", e))
}

#[tauri::command]
async fn save_config(app: AppHandle, config: ApiConfig) -> Result<(), String> {
    let config_path = get_config_path(&app)?;

    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    if let Some(parent_dir) = config_path.parent() {
        fs::create_dir_all(parent_dir)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let mut file = File::create(&config_path)
        .map_err(|e| format!("Failed to create config file: {}", e))?;

    file.write_all(config_json.as_bytes())
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn load_config(app: AppHandle) -> Result<Option<ApiConfig>, String> {
    let config_path = get_config_path(&app)?;

    if !config_path.exists() {
        return Ok(None);
    }

    let mut file = File::open(&config_path)
        .map_err(|e| format!("Failed to open config file: {}", e))?;

    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    if contents.trim().is_empty() {
        return Ok(None);
    }

    let config: ApiConfig = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;

    Ok(Some(config))
}

#[tauri::command]
async fn get_player_list(config: ApiConfig) -> Result<ApiResponse<Option<PlayerListData>>, String> {
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs(seconds as u64),
        _ => Duration::from_secs(3),
    };
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let url = format!("http://{}:{}/player/list?password={}", config.host, config.port, config.password);

    match client.get(&url).send().await {
        Ok(response) => match response.json::<ApiResponse<Option<PlayerListData>>>().await {
            Ok(data) => Ok(data),
            Err(e) => Err(format!("Failed to parse JSON response: {}", e)),
        },
        Err(e) => Err(format!("Failed to make request: {}", e)),
    }
}

#[tauri::command]
async fn get_player_count(config: ApiConfig) -> Result<ApiResponse<Option<PlayerCountData>>, String> {
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs(seconds as u64),
        _ => Duration::from_secs(3),
    };
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let url = format!("http://{}:{}/player/count?password={}", config.host, config.port, config.password);

    match client.get(&url).send().await {
        Ok(response) => {
            match response.json::<ApiResponse<Option<PlayerCountData>>>().await {
                Ok(data) => Ok(data),
                Err(e) => Err(format!("Failed to parse JSON response: {}", e)),
            }
        },
        Err(e) => Err(format!("Failed to make request: {}", e)),
    }
}

#[tauri::command]
async fn send_chat_message(config: ApiConfig, payload: ChatMessagePayload) -> Result<ApiResponse<()>, String> {
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs(seconds as u64),
        _ => Duration::from_secs(3),
    };
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        
    let url = format!(
        "http://{}:{}/chat?password={}&message={}",
        config.host,
        config.port,
        config.password,
        payload.message
    );

    match client.post(&url)
            .header(reqwest::header::CONTENT_LENGTH, "0")
            .body("")
            .send().await {
        Ok(response) => {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_else(|e| format!("Failed to read response body: {}", e));
            let succeeded = status.is_success();

            match serde_json::from_str::<ApiResponse<()>>(&body_text) {
                Ok(parsed_response) => {
                    Ok(parsed_response)
                },
                Err(_) => {
                    Ok(ApiResponse {
                        data: if succeeded { Some(()) } else { None },
                        message: format!("Status: {}. Raw Body: {}", status, body_text),
                        succeeded,
                    })
                }
            }
        },
        Err(e) => Err(format!("Failed to make request: {}", e)),
    }
}

#[tauri::command]
async fn kick_player(config: ApiConfig, payload: KickPlayerPayload) -> Result<ApiResponse<()>, String> {
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs(seconds as u64),
        _ => Duration::from_secs(3),
    };
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        
    let url = format!(
        "http://{}:{}/player/kick?password={}&unique_id={}",
        config.host,
        config.port,
        config.password,
        payload.unique_id
    );

    match client.post(&url)
            .header(reqwest::header::CONTENT_LENGTH, "0")
            .body("")
            .send().await {
        Ok(response) => {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_else(|e| format!("Failed to read response body: {}", e));
            let succeeded = status.is_success();

            match serde_json::from_str::<ApiResponse<()>>(&body_text) {
                Ok(parsed_response) => Ok(parsed_response),
                Err(_) => Ok(ApiResponse {
                    data: if succeeded { Some(()) } else { None },
                    message: format!("Status: {}. Raw Body: {}", status, body_text),
                    succeeded,
                }),
            }
        },
        Err(e) => Err(format!("Failed to make request: {}", e)),
    }
}

#[tauri::command]
async fn ban_player(config: ApiConfig, payload: BanPlayerPayload) -> Result<ApiResponse<()>, String> {
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs(seconds as u64),
        _ => Duration::from_secs(3),
    };
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        
    let url = format!(
        "http://{}:{}/player/ban?password={}&unique_id={}",
        config.host,
        config.port,
        config.password,
        payload.unique_id
    );

    match client.post(&url)
            .header(reqwest::header::CONTENT_LENGTH, "0")
            .body("")
            .send().await {
        Ok(response) => {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_else(|e| format!("Failed to read response body: {}", e));
            let succeeded = status.is_success();

            match serde_json::from_str::<ApiResponse<()>>(&body_text) {
                Ok(parsed_response) => Ok(parsed_response),
                Err(_) => Ok(ApiResponse {
                    data: if succeeded { Some(()) } else { None },
                    message: format!("Status: {}. Raw Body: {}", status, body_text),
                    succeeded,
                }),
            }
        },
        Err(e) => Err(format!("Failed to make request: {}", e)),
    }
}

#[tauri::command]
async fn unban_player(config: ApiConfig, payload: UnbanPlayerPayload) -> Result<ApiResponse<()>, String> {
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs(seconds as u64),
        _ => Duration::from_secs(3),
    };
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
        
    let url = format!(
        "http://{}:{}/player/unban?password={}&unique_id={}",
        config.host,
        config.port,
        config.password,
        payload.unique_id
    );

    match client.post(&url)
            .header(reqwest::header::CONTENT_LENGTH, "0")
            .body("")
            .send().await {
        Ok(response) => {
            let status = response.status();
            let body_text = response.text().await.unwrap_or_else(|e| format!("Failed to read response body: {}", e));
            let succeeded = status.is_success();

            match serde_json::from_str::<ApiResponse<()>>(&body_text) {
                Ok(parsed_response) => Ok(parsed_response),
                Err(_) => Ok(ApiResponse {
                    data: if succeeded { Some(()) } else { None },
                    message: format!("Status: {}. Raw Body: {}", status, body_text),
                    succeeded,
                }),
            }
        },
        Err(e) => Err(format!("Failed to make request: {}", e)),
    }
}

#[tauri::command]
async fn get_ban_list(config: ApiConfig) -> Result<ApiResponse<Option<BanListData>>, String> {
    println!("[get_ban_list] Starting request to {}:{}", config.host, config.port);
    
    let timeout_duration = match config.player_list_poll_rate_seconds {
        Some(seconds) if seconds > 0 => Duration::from_secs((seconds + 5) as u64),
        _ => Duration::from_secs(10),
    };
    
    println!("[get_ban_list] Using timeout: {:?}", timeout_duration);
    
    let client = reqwest::Client::builder()
        .timeout(timeout_duration)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    println!("[get_ban_list] Client created successfully");
    
    let url = format!("http://{}:{}/player/banlist?password={}", config.host, config.port, config.password);
    println!("[get_ban_list] About to send request to {}", url);

    let start_time = std::time::Instant::now();
    match client.get(&url).send().await {
        Ok(response) => {
            let elapsed = start_time.elapsed();
            let status = response.status();
            println!("[get_ban_list] Response received in {:?}", elapsed);
            println!("[get_ban_list] Status: {}", status);
            
            match response.text().await {
                Ok(text) => {
                    println!("[get_ban_list] Response text: {}", text);
                    
                    if text.is_empty() {
                        return Ok(ApiResponse {
                            data: None,
                            message: "Empty response received".to_string(),
                            succeeded: false,
                        });
                    }
                    
                    match serde_json::from_str::<ApiResponse<Option<BanListData>>>(&text) {
                        Ok(data) => {
                            println!("[get_ban_list] Successfully parsed JSON, success={}", data.succeeded);
                            Ok(data)
                        },
                        Err(e) => {
                            println!("[get_ban_list] JSON parse error: {}", e);
                            
                            if text.contains("No banned players") {
                                println!("[get_ban_list] Detected 'No banned players' message");
                                let empty_ban_data = BanListData {
                                    banned_players: std::collections::HashMap::new(),
                                };
                                return Ok(ApiResponse {
                                    data: Some(Some(empty_ban_data)),
                                    message: "No banned players".to_string(),
                                    succeeded: true,
                                });
                            }
                            
                            Ok(ApiResponse {
                                data: None,
                                message: format!("JSON parsing error: {}", e),
                                succeeded: false,
                            })
                        },
                    }
                },
                Err(e) => {
                    println!("[get_ban_list] Failed to read response text: {}", e);
                    Ok(ApiResponse {
                        data: None,
                        message: format!("Failed to read response body: {}", e),
                        succeeded: false,
                    })
                },
            }
        },
        Err(e) => {
            let elapsed = start_time.elapsed();
            println!("[get_ban_list] Request failed after {:?}: {}", elapsed, e);
            
            if e.is_timeout() {
                println!("[get_ban_list] Timeout detected!");
                return Ok(ApiResponse {
                    data: None,
                    message: "Request timed out".to_string(),
                    succeeded: false,
                });
            }
            
            Ok(ApiResponse {
                data: None,
                message: format!("Request failed: {}", e),
                succeeded: false,
            })
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_config,
            load_config,
            get_player_list,
            send_chat_message,
            get_player_count,
            kick_player,
            ban_player,
            unban_player,
            get_ban_list
        ])
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
