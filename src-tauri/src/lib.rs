use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

fn toggle_widget(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("widget") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

fn open_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        // A menu-bar (tray) icon so the reminder widget and the app are always
        // reachable even when every window is hidden.
        .setup(|app| {
            let toggle = MenuItem::with_id(app, "toggle_widget", "Show / Hide Reminders", true, None::<&str>)?;
            let open = MenuItem::with_id(app, "open_main", "Open WorkBase", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit WorkBase", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &open, &quit])?;
            let _tray = TrayIconBuilder::with_id("workbase-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("WorkBase")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle_widget" => toggle_widget(app),
                    "open_main" => open_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        // Closing a window hides it and keeps WorkBase running in the
        // background so the always-on-top reminder widget stays available.
        // Fully quit with Cmd+Q.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running WorkBase")
        .run(|app, event| {
            match event {
                // macOS: clicking the dock icon re-opens the main window.
                #[cfg(target_os = "macos")]
                tauri::RunEvent::Reopen { .. } => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                _ => {}
            }
            let _ = app;
        });
}
