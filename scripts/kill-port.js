import { exec } from 'child_process';
import net from 'net';

function isPortFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(port, () => { s.close(() => resolve(true)); });
    s.on('error', () => resolve(false));
  });
}

async function killPort(port) {
  return new Promise((resolve) => {
    exec(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`,
      () => resolve()
    );
  });
}

async function main() {
  for (const port of [5000, 3000]) {
    const free = await isPortFree(port);
    if (!free) {
      console.log(`[predev] Port ${port} in use, releasing...`);
      await killPort(port);
      console.log(`[predev] Port ${port} released.`);
    }
  }
  console.log('[predev] Ports 5000 and 3000 are free — ready to start.');
  process.exit(0);
}

main();
