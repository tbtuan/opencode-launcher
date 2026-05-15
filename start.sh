#!/bin/bash
cd "$(dirname "$0")"
nohup npm start > /dev/null 2>&1 &
