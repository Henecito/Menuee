#!/usr/bin/env node
/**
 * Bridge local: comandas JSON → ESC/POS silencioso.
 *
 * Modo por defecto (Mac POS USB 80mm): CUPS raw (`lp -o raw`) sobre cola USB.
 *
 * Variables de entorno:
 *   COMANDA_BRIDGE_PORT=17890
 *   COMANDA_PRINT_MODE=usb          (usb | cups | tcp — usb/cups equivalentes en Mac)
 *   COMANDA_PRINTERS_JSON={"default":"POS-80","Barra":"POS-Barra"}
 *     → valores = nombre de cola CUPS (System Settings → Printers)
 *   COMANDA_USB_DEVICE=/dev/cu.usbserial-XXX   (opcional, escritura directa al puerto)
 *   COMANDA_USB_PRINTER_MATCH=POS|80|thermal   (regex para auto-detectar cola CUPS)
 *   COMANDA_USB_DEFAULT=POS-80                 (cola CUPS por defecto)
 *   COMANDA_CORS_ORIGIN=http://localhost:3000
 *
 * Modo TCP legacy (solo si COMANDA_PRINT_MODE=tcp):
 *   COMANDA_PRINTERS_JSON={"default":"192.168.1.50:9100"}
 *
 * Front (.env):
 *   REACT_APP_COMANDA_PRINT_URL=http://127.0.0.1:17890
 */

import http from "http";
import net from "net";
import { execFile, execFileSync, execSync } from "child_process";
import {
  writeFileSync,
  unlinkSync,
  createWriteStream,
  existsSync,
} from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PORT = Number(process.env.COMANDA_BRIDGE_PORT || 17890);
const CORS_ORIGIN = process.env.COMANDA_CORS_ORIGIN || "*";
const LINE_WIDTH = 32;
const PRINT_MODE = String(
  process.env.COMANDA_PRINT_MODE || "usb"
).toLowerCase();

let PRINTERS = {};
try {
  if (process.env.COMANDA_PRINTERS_JSON) {
    PRINTERS = JSON.parse(process.env.COMANDA_PRINTERS_JSON);
  }
} catch (e) {
  console.error("[comanda-bridge] COMANDA_PRINTERS_JSON inválido:", e.message);
  process.exit(1);
}

const ESC = 0x1b;
const GS = 0x1d;

let detectedCupsPrinter = null;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function runLpstat(args) {
  try {
    return execSync(`lpstat ${args}`, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

/** Colas CUPS instaladas en macOS (incluye impresoras USB). */
function listCupsPrinters() {
  const out = runLpstat("-p");
  const names = [...out.matchAll(/^printer\s+(\S+)/gm)].map((m) => m[1]);
  return [...new Set(names)];
}

function cupsPrinterDeviceUri(cupsName) {
  const out = runLpstat(`-v ${cupsName}`);
  const m = out.match(/device for .+?:\s*(.+)/i);
  return m ? m[1].trim() : "";
}

function isUsbBackedCupsQueue(cupsName) {
  const uri = cupsPrinterDeviceUri(cupsName);
  return /usb/i.test(uri) || /^\/dev\//i.test(uri);
}

/** Auto-detecta impresora térmica USB vía CUPS (Mac). */
function detectUsbCupsPrinter() {
  if (process.env.COMANDA_USB_DEFAULT) {
    return process.env.COMANDA_USB_DEFAULT.trim();
  }

  const printers = listCupsPrinters();
  if (!printers.length) return null;

  const matchPattern = process.env.COMANDA_USB_PRINTER_MATCH;
  if (matchPattern) {
    try {
      const re = new RegExp(matchPattern, "i");
      const hit = printers.find((p) => re.test(p));
      if (hit) return hit;
    } catch (e) {
      console.warn("[comanda-bridge] COMANDA_USB_PRINTER_MATCH inválido:", e.message);
    }
  }

  const usbQueues = printers.filter(isUsbBackedCupsQueue);
  if (usbQueues.length === 1) return usbQueues[0];
  if (usbQueues.length > 1) {
    const thermal = usbQueues.filter((p) =>
      /pos|thermal|receipt|80|tm-|tsp|epson|star|xprinter|bixolon|cocina|barra/i.test(p)
    );
    if (thermal.length >= 1) return thermal[0];
    return usbQueues[0];
  }

  const thermal = printers.filter((p) =>
    /pos|thermal|receipt|80|tm-|tsp|epson|star|xprinter|bixolon/i.test(p)
  );
  if (thermal.length >= 1) return thermal[0];
  if (printers.length === 1) return printers[0];

  return null;
}

function detectUsbSerialDevice() {
  const fromEnv = process.env.COMANDA_USB_DEVICE;
  if (fromEnv && existsSync(fromEnv)) return fromEnv.trim();

  try {
    const entries = execFileSync("ls", ["/dev"], { encoding: "utf8" })
      .split("\n")
      .map((e) => e.trim())
      .filter(Boolean);
    const candidates = entries
      .filter(
        (e) =>
          e.startsWith("cu.usb") ||
          e.startsWith("cu.usbserial") ||
          e.startsWith("cu.usbmodem")
      )
      .map((e) => `/dev/${e}`);
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) return candidates[0];
  } catch {
    /* ignore */
  }

  return null;
}

function resolveMappedPrinter(grupo) {
  const g = String(grupo || "").trim();
  if (g && PRINTERS[g]) return PRINTERS[g];
  const lower = g.toLowerCase();
  for (const [key, target] of Object.entries(PRINTERS)) {
    if (key.toLowerCase() === lower) return target;
  }
  return PRINTERS.default || null;
}

function isTcpTarget(target) {
  const t = String(target || "").trim();
  return (
    PRINT_MODE === "tcp" ||
    /^\d{1,3}(\.\d{1,3}){3}:\d+/.test(t) ||
    /^[\w.-]+:\d{3,5}$/.test(t)
  );
}

function resolvePrintTarget(grupo) {
  const mapped = resolveMappedPrinter(grupo);

  if (mapped) {
    const t = String(mapped).trim();
    if (isTcpTarget(t)) return { kind: "tcp", target: t };
    if (t.startsWith("/dev/")) return { kind: "device", path: t };
    return { kind: "cups", name: t };
  }

  if (PRINT_MODE === "tcp") {
    throw new Error(
      "COMANDA_PRINTERS_JSON requerido en modo tcp (host:puerto)."
    );
  }

  const device = detectUsbSerialDevice();
  if (device) return { kind: "device", path: device };

  const cups =
    detectedCupsPrinter ||
    detectUsbCupsPrinter() ||
    process.env.COMANDA_USB_DEFAULT?.trim();
  if (cups) return { kind: "cups", name: cups };

  throw new Error(
    "No se detectó impresora USB. Instalá la POS 80 en macOS (Ajustes → Impresoras) " +
      "o definí COMANDA_PRINTERS_JSON / COMANDA_USB_DEFAULT / COMANDA_USB_DEVICE."
  );
}

function parseHostPort(value) {
  const raw = String(value || "").trim();
  const idx = raw.lastIndexOf(":");
  if (idx <= 0) return { host: raw, port: 9100 };
  return {
    host: raw.slice(0, idx),
    port: Number(raw.slice(idx + 1)) || 9100,
  };
}

function latin1Buffer(text) {
  return Buffer.from(String(text ?? ""), "latin1");
}

function cmd(...bytes) {
  return Buffer.from(bytes);
}

function lineFeed(chunks, text = "") {
  chunks.push(latin1Buffer(text));
  chunks.push(cmd(0x0a));
}

function separator(chunks) {
  lineFeed(chunks, "=".repeat(LINE_WIDTH));
}

function buildEscposBuffer(ticket) {
  const chunks = [];
  chunks.push(cmd(ESC, 0x40));
  chunks.push(cmd(ESC, 0x61, 0x01));

  separator(chunks);
  lineFeed(chunks, String(ticket.titulo || "COMANDA").toUpperCase());
  lineFeed(chunks, `Mesa ${ticket.mesaNumero ?? ""}`);
  lineFeed(chunks, String(ticket.fechaHora || ""));
  separator(chunks);
  lineFeed(chunks, "");

  chunks.push(cmd(ESC, 0x61, 0x00));
  for (const row of ticket.lineas || []) {
    const cant = Number(row.cantidad) || 0;
    const nombre = String(row.nombre || "Producto");
    lineFeed(chunks, `${cant}x ${nombre}`);
    if (row.comentario) {
      lineFeed(chunks, `  ${row.comentario}`);
    }
  }

  lineFeed(chunks, "");
  chunks.push(cmd(ESC, 0x61, 0x01));
  separator(chunks);
  lineFeed(chunks, "");
  lineFeed(chunks, "");
  lineFeed(chunks, "");

  chunks.push(cmd(ESC, 0x64, 0x05));
  chunks.push(cmd(GS, 0x56, 0x00));

  return Buffer.concat(chunks);
}

function sendToTcp(hostPort, data) {
  const { host, port } = parseHostPort(hostPort);
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write(data, (err) => {
        if (err) {
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
        resolve();
      });
    });

    socket.setTimeout(10000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Timeout conectando a ${host}:${port}`));
    });
    socket.on("error", reject);
  });
}

/** ESC/POS raw a cola CUPS (impresora USB registrada en macOS). */
function sendToCupsRaw(cupsName, data) {
  const tmpFile = join(tmpdir(), `comanda-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
  writeFileSync(tmpFile, data);

  return new Promise((resolve, reject) => {
    execFile(
      "lp",
      [
        "-d",
        cupsName,
        "-o",
        "raw",
        "-o",
        "document-format=application/octet-stream",
        tmpFile,
      ],
      (err, _stdout, stderr) => {
        try {
          unlinkSync(tmpFile);
        } catch {
          /* ignore */
        }
        if (err) {
          reject(
            new Error(
              stderr?.trim() ||
                err.message ||
                `No se pudo imprimir en cola CUPS "${cupsName}"`
            )
          );
          return;
        }
        resolve();
      }
    );
  });
}

/** Escritura directa al puerto serie USB (fallback si no hay CUPS). */
function sendToUsbDevice(devicePath, data) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(devicePath, { flags: "w" });
    stream.on("error", reject);
    stream.write(data, (err) => {
      if (err) {
        reject(err);
        return;
      }
      stream.end(() => resolve());
    });
  });
}

async function dispatchPrint(target, data) {
  if (target.kind === "tcp") {
    await sendToTcp(target.target, data);
    return `tcp:${target.target}`;
  }
  if (target.kind === "device") {
    await sendToUsbDevice(target.path, data);
    return `usb:${target.path}`;
  }
  await sendToCupsRaw(target.name, data);
  return `cups:${target.name}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function startupDiagnostics() {
  detectedCupsPrinter = detectUsbCupsPrinter();
  const cupsList = listCupsPrinters();
  const usbDevice = detectUsbSerialDevice();

  console.log(`[comanda-bridge] Modo: ${PRINT_MODE} (USB/CUPS por defecto en Mac)`);
  console.log("[comanda-bridge] Colas CUPS:", cupsList.length ? cupsList.join(", ") : "(ninguna)");
  if (detectedCupsPrinter) {
    const uri = cupsPrinterDeviceUri(detectedCupsPrinter);
    console.log(
      `[comanda-bridge] USB detectada (CUPS): "${detectedCupsPrinter}"${uri ? ` → ${uri}` : ""}`
    );
  }
  if (usbDevice) {
    console.log(`[comanda-bridge] Puerto serie USB detectado: ${usbDevice}`);
  }
  if (Object.keys(PRINTERS).length) {
    console.log("[comanda-bridge] Mapeo grupos:", PRINTERS);
  }
}

const server = http.createServer(async (req, res) => {
  const headers = {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, mode: PRINT_MODE }));
    return;
  }

  if (req.method === "GET" && req.url === "/printers") {
    const cups = listCupsPrinters().map((name) => ({
      name,
      usb: isUsbBackedCupsQueue(name),
      uri: cupsPrinterDeviceUri(name),
    }));
    res.writeHead(200, headers);
    res.end(
      JSON.stringify({
        mode: PRINT_MODE,
        detected: detectedCupsPrinter,
        cups,
        usbDevice: detectUsbSerialDevice(),
        mapping: PRINTERS,
      })
    );
    return;
  }

  if (req.method !== "POST" || req.url !== "/print") {
    res.writeHead(404, headers);
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  try {
    const raw = await readBody(req);
    const { grupo, ticket } = JSON.parse(raw || "{}");
    if (!ticket) {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: "ticket requerido" }));
      return;
    }

    const target = resolvePrintTarget(grupo);
    const buffer = buildEscposBuffer(ticket);
    const dest = await dispatchPrint(target, buffer);

    console.log(
      `[comanda-bridge] OK grupo="${grupo || "-"}" → ${dest} (${buffer.length} bytes ESC/POS)`
    );
    res.writeHead(200, headers);
    res.end(JSON.stringify({ ok: true, dest }));
  } catch (e) {
    console.error("[comanda-bridge] Error:", e.message);
    res.writeHead(500, headers);
    res.end(JSON.stringify({ error: e.message || "error" }));
  }
});

startupDiagnostics();

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[comanda-bridge] Escuchando en http://127.0.0.1:${PORT}`);
  console.log("[comanda-bridge] Diagnóstico: GET /printers");
});
