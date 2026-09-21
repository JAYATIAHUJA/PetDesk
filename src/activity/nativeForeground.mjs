// nativeForeground.mjs — Synchronous foreground-window lookup through user32/kernel32 (koffi FFI)
import { createRequire } from 'node:module';

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const TITLE_CHARS = 512;
const PATH_CHARS = 1024;

let api = null;

function loadApi() {
  if (api) return api;
  if (process.platform !== 'win32') throw new Error('Foreground detection is only available on Windows');

  // koffi ships prebuilt binaries; load it lazily so other platforms never touch it
  const koffi = createRequire(import.meta.url)('koffi');
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');

  api = {
    koffi,
    GetForegroundWindow: user32.func('void* __stdcall GetForegroundWindow()'),
    GetWindowTextW: user32.func('int __stdcall GetWindowTextW(void* hWnd, _Out_ uint16_t* text, int maxCount)'),
    GetWindowThreadProcessId: user32.func('uint32_t __stdcall GetWindowThreadProcessId(void* hWnd, _Out_ uint32_t* processId)'),
    OpenProcess: kernel32.func('void* __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t processId)'),
    QueryFullProcessImageNameW: kernel32.func('bool __stdcall QueryFullProcessImageNameW(void* process, uint32_t flags, _Out_ uint16_t* path, _Inout_ uint32_t* size)'),
    CloseHandle: kernel32.func('bool __stdcall CloseHandle(void* handle)'),
  };
  return api;
}

function decodeWide(buffer, chars) {
  return Buffer.from(buffer.buffer, 0, chars * 2).toString('utf16le');
}

function queryProcessPath(processId) {
  const handle = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, processId);
  if (!handle) return ''; // protected/system process
  try {
    const pathBuffer = new Uint16Array(PATH_CHARS);
    const size = [PATH_CHARS];
    return api.QueryFullProcessImageNameW(handle, 0, pathBuffer, size) ? decodeWide(pathBuffer, size[0]) : '';
  } finally {
    api.CloseHandle(handle);
  }
}

// Returns { pid, exe, title, hwnd } for the focused window, or null when nothing has focus.
function getForegroundWindow() {
  const { koffi, GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId } = loadApi();

  const hwnd = GetForegroundWindow();
  if (!hwnd) return null;

  const titleBuffer = new Uint16Array(TITLE_CHARS);
  const titleLength = GetWindowTextW(hwnd, titleBuffer, TITLE_CHARS);

  const processId = [0];
  GetWindowThreadProcessId(hwnd, processId);

  return {
    pid: processId[0],
    exe: processId[0] ? queryProcessPath(processId[0]) : '',
    title: decodeWide(titleBuffer, Math.max(0, titleLength)),
    hwnd: Number(koffi.address(hwnd)),
  };
}

export { getForegroundWindow };
