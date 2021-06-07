"use strict";

import fs from "fs";
import util from "util";

const log_file = fs.createWriteStream("/Users/leifriksheim/debug.log", {
  flags: "w",
});
const log_stdout = process.stdout;

console.log = function (...args: any) {
  args.forEach((arg: any) => {
    log_file.write(util.format(arg) + "\n");
    log_stdout.write(util.format(arg) + "\n");
  });
};

import { app, protocol, BrowserWindow, ipcMain } from "electron";
import { createProtocol } from "vue-cli-plugin-electron-builder/lib";
import installExtension, { VUEJS_DEVTOOLS } from "electron-devtools-installer";
import ad4m from "@perspect3vism/ad4m-executor";
import path from "path";
import os from "os";

let win: BrowserWindow;
let Core: ad4m.PerspectivismCore;
let builtInLangPath: string;

const isDevelopment = process.env.NODE_ENV !== "production";

console.log("Trying to run!");

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension({
        id: "ljjemllljcmogpfapbkkighbhhppjdbg",
        electron: ">=1.2.1",
      });
    } catch (e) {
      console.error("Vue Devtools failed to install:", e.toString());
    }
  }

  let execPath;
  if (app.isPackaged) {
    console.log("App is running in production mode");
    //TODO: this code is probably somewhat broken
    builtInLangPath = path.resolve(
      `${process.resourcesPath}/../Resources/packaged-resources/languages`
    );
    execPath = path.resolve(
      `${process.resourcesPath}/../Resources/packaged-resources/bin`
    );
    log_file.write(execPath);
    log_file.write(builtInLangPath);
  } else {
    console.log("App is running in dev mode");
    builtInLangPath = path.resolve(`${__dirname}/../ad4m/languages`);
    execPath = path.resolve(`${__dirname}/../resources/${os.platform}/`);
  }
  console.log(
    "\x1b[1m",
    "Using Resource path",
    execPath,
    "built in language path",
    builtInLangPath
  );

  const userDataPath = app.getPath("userData");
  fs.appendFile(userDataPath + "/hello.txt", "Hello content!", function (err) {
    if (err) throw err;
    console.log("Saved!");
  });

  console.log({ userDataPath });

  //createWindow();
  console.log("\x1b[36m%s\x1b[0m", "Init AD4M...");
  ad4m
    .init(
      app.getPath("userData"),
      execPath,
      builtInLangPath,
      ["languages", "shared-perspectives"],
      false
    )
    .then((ad4mCore: ad4m.PerspectivismCore) => {
      Core = ad4mCore;
      console.log(
        "\x1b[36m%s\x1b[0m",
        "Starting account creation splash screen"
      );

      createWindow();
      Core.waitForAgent().then(async () => {
        console.log(
          "\x1b[36m%s\x1b[0m",
          "Agent has been init'd. Controllers now starting init..."
        );
        Core.initControllers();
        await Core.initLanguages();
        console.log("\x1b[32m", "Controllers init complete!");
      });
    });
});

async function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: false,
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.join(__dirname, "preload.js"), // use a preload script
    },
  });
  win.removeMenu();

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL as string);
    if (!process.env.IS_TEST) win.webContents.openDevTools();
  } else {
    createProtocol("app");
    // Load the index.html when not in development
    win.loadURL(`file://${__dirname}/index.html`);
  }
}

ipcMain.on("ping", () => {
  win.webContents.send("pong", "Hello from main thread!");
});

ipcMain.on("getLangPath", () => {
  win.webContents.send("getLangPathResponse", builtInLangPath);
});

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { secure: true, standard: true } },
]);

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === "win32") {
    process.on("message", (data) => {
      if (data === "graceful-exit") {
        app.quit();
      }
    });
  } else {
    process.on("SIGTERM", () => {
      app.quit();
    });
  }
}

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  console.log("Got window-all-closed signal");
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  //if (process.platform !== "darwin") {
  //Quit PerspectivismCore
  Core.exit();
  app.quit();
  //}
});

// Quit when all windows are closed.
app.on("will-quit", () => {
  console.log("Got quit quit signal");
  //Quit PerspectivismCore
  Core.exit();
  app.quit();
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
  // application specific logging, throwing an error, or other logic here
});
