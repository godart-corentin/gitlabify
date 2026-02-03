fn main() {
    // Load .env file
    if let Ok(path) = dotenvy::dotenv() {
        println!("cargo:rerun-if-changed={}", path.display());
    }

    // Embed environment variables into the binary
    if let Ok(val) = std::env::var("GITLAB_CLIENT_ID") {
        println!("cargo:rustc-env=GITLAB_CLIENT_ID={}", val);
    }

    tauri_build::build()
}
