!include "FileFunc.nsh"

!define MUI_PAGE_HEADER_TEXT "Termos de Uso e Politica de Privacidade"
!define MUI_PAGE_HEADER_SUBTEXT "Leia o resumo legal antes de instalar o HappyCash."
!define MUI_LICENSEPAGE_RADIOBUTTONS
!define MUI_LICENSEPAGE_TEXT_TOP "Leia todo o texto abaixo antes de escolher uma das opcoes."
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Para continuar a instalacao, escolha uma opcao abaixo. Sem aceite, a instalacao sera cancelada."
!define MUI_LICENSEPAGE_RADIOBUTTONS_TEXT_ACCEPT "Concordo com os Termos de Uso e com a Politica de Privacidade."
!define MUI_LICENSEPAGE_RADIOBUTTONS_TEXT_DECLINE "Nao concordo e quero cancelar a instalacao."

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
