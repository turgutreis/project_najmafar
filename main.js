const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');

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

    win.webContents.on('console-message', (event, level, message) => {
        console.log(`[Renderer] ${message}`);
    });
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

// IPC Handler to Load Universe Data reliably from disk
ipcMain.handle('load-universe-data', async () => {
    try {
        const filePath = path.join(__dirname, 'universe_data.json');
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return { success: true, data: JSON.parse(raw) };
        }
        return { success: false, error: 'universe_data.json not found on disk' };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

// IPC Listener to Close App
ipcMain.on('close-app', () => {
    app.quit();
});
