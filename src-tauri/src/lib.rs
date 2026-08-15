use tauri::{
    menu::{AboutMetadataBuilder, Menu, MenuBuilder, MenuItem, SubmenuBuilder},
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
            // Proper macOS menu bar with an About panel carrying our company info.
            let about = AboutMetadataBuilder::new()
                .name(Some("WorkBase"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .copyright(Some("© VOCSO Technologies Pvt Ltd"))
                .website(Some("https://vocso.com"))
                .website_label(Some("vocso.com"))
                .comments(Some("Local-first project management by VOCSO Technologies Pvt Ltd.\nSupport: info@vocso.com"))
                .authors(Some(vec!["VOCSO Technologies Pvt Ltd".to_string()]))
                .build();
            let app_menu = SubmenuBuilder::new(app, "WorkBase")
                .about(Some(about))
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;
            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .separator()
                .close_window()
                .build()?;
            let menubar = MenuBuilder::new(app).items(&[&app_menu, &edit_menu, &window_menu]).build()?;
            app.set_menu(menubar)?;

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
