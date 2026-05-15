Dim dir
dir = WScript.Arguments(0)

Dim WshShell
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = dir
WshShell.Run "npm start", 0, False
