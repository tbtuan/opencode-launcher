Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""%~dp0"" && npm start", 0, False
