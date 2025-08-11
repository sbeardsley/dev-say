#!/usr/bin/env node

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PID_FILE = path.join(os.homedir(), '.dev-say.pid');
const LOG_FILE = path.join(os.homedir(), '.dev-say.log');

async function start() {
  try {
    const pid = await getPid();
    if (pid && isProcessRunning(pid)) {
      console.log(`dev-say server is already running (PID: ${pid})`);
      return;
    }
  } catch (e) {
    // PID file doesn't exist or is invalid, continue with start
  }

  console.log('Starting dev-say server...');
  
  const serverPath = path.join(__dirname, '..', 'dist', 'server.js');
  
  const out = await fs.open(LOG_FILE, 'a');
  const err = await fs.open(LOG_FILE, 'a');
  
  const child = spawn('node', [serverPath], {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, MCP_TRANSPORT: 'http' }
  });
  
  child.unref();
  
  await fs.writeFile(PID_FILE, child.pid.toString());
  
  console.log(`dev-say server started (PID: ${child.pid})`);
  console.log(`Server running at: http://localhost:8837`);
  console.log(`Logs available at: ${LOG_FILE}`);
}

async function stop() {
  try {
    const pid = await getPid();
    if (!pid) {
      console.log('dev-say server is not running');
      return;
    }
    
    if (!isProcessRunning(pid)) {
      console.log('dev-say server is not running (stale PID file)');
      await fs.unlink(PID_FILE).catch(() => {});
      return;
    }
    
    process.kill(pid, 'SIGTERM');
    await fs.unlink(PID_FILE).catch(() => {});
    console.log(`dev-say server stopped (PID: ${pid})`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('dev-say server is not running');
    } else {
      console.error('Error stopping server:', error.message);
      process.exit(1);
    }
  }
}

async function status() {
  try {
    const pid = await getPid();
    if (pid && isProcessRunning(pid)) {
      console.log(`dev-say server is running (PID: ${pid})`);
      console.log(`Server at: http://localhost:8837`);
      console.log(`Logs at: ${LOG_FILE}`);
    } else {
      console.log('dev-say server is not running');
      if (pid) {
        await fs.unlink(PID_FILE).catch(() => {});
      }
    }
  } catch (error) {
    console.log('dev-say server is not running');
  }
}

async function restart() {
  await stop();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await start();
}

async function logs() {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf-8');
    console.log(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No log file found. Server may not have been started yet.');
    } else {
      console.error('Error reading logs:', error.message);
    }
  }
}

async function getPid() {
  const content = await fs.readFile(PID_FILE, 'utf-8');
  return parseInt(content.trim(), 10);
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      await start();
      break;
    case 'stop':
      await stop();
      break;
    case 'status':
      await status();
      break;
    case 'restart':
      await restart();
      break;
    case 'logs':
      await logs();
      break;
    default:
      console.log('Usage: dev-say <command>');
      console.log('');
      console.log('Commands:');
      console.log('  start    - Start the dev-say server');
      console.log('  stop     - Stop the dev-say server');
      console.log('  status   - Check if the server is running');
      console.log('  restart  - Restart the server');
      console.log('  logs     - Show server logs');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});