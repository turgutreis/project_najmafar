const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Project Najmafar",
        backgroundColor: '#030712',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
    win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler for Quantum Universe Generation
ipcMain.handle('generate-universe', async (event, apiKey, useQpu) => {
    return new Promise((resolve) => {
        // Build terminal command
        // We use python3 (macOS standard)
        let cmd = `python3 generate_universe.py`;
        if (apiKey) {
            // Escape double quotes to prevent shell injection
            const cleanKey = apiKey.replace(/"/g, '\\"');
            cmd += ` --api-key "${cleanKey}"`;
        }
        if (useQpu) {
            cmd += ` --qpu`;
        }

        console.log("Najmafar: Running command:", cmd);

        exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                console.error("Najmafar: Generation error:", error);
                resolve({ success: false, error: stderr || error.message });
            } else {
                console.log("Najmafar: Generation success:\n", stdout);
                resolve({ success: true, log: stdout });
            }
        });
    });
});

// IPC Listener to Close App
ipcMain.on('close-app', () => {
    app.quit();
});
