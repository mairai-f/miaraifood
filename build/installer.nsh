!include "FileFunc.nsh"

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  GetTempFileName $0
  Delete $0
  ${GetTime} "" "L" $1 $2 $3 $4 $5 $6 $7
  FileOpen $8 "$INSTDIR\install-token.txt" w
  IfErrors +3
  FileWrite $8 "$3$2$1-$5$6$7-$0"
  FileClose $8
!macroend
