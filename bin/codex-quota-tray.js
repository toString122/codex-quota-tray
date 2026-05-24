#!/usr/bin/env node

const path = require('node:path');
const { spawn } = require('node:child_process');
const electron = require('electron');

const appPath = path.resolve(__dirname, '..');
const child = spawn(electron, [appPath], {
  detached: true,
  stdio: 'ignore',
  windowsHide: false
});

child.unref();
