; Custom NSIS install hooks for Liquid Relay
;
; The electron-builder NSIS installer runs elevated (perMachine: true), so we
; can register Windows Firewall rules here without ever showing the user a
; separate UAC prompt at runtime — they only see the standard one Windows shows
; for any installer.
;
; Two rules are added:
;   1. Inbound TCP on port 53000 — the Liquid Relay peer-to-peer server.
;   2. Inbound UDP on port 5353 — mDNS, so this PC can RECEIVE peer
;      announcements over the network. Without this rule, discovery is
;      asymmetric: the Macs see the PC but the PC doesn't see the Macs.
;
; Both rules use profile=any (Private + Domain + Public). Windows can silently
; reclassify a network from Private → Public after sleep/wake, DHCP renewal,
; or router restart; profile=any keeps the rules effective regardless.
;
; Rules are removed on uninstall to keep the firewall config tidy.

!macro customInstall
  DetailPrint "Configuring Windows Firewall for Liquid Relay..."

  ; Idempotent: remove any pre-existing rules with our names so reinstall
  ; (or upgrade installs that don't run uninstall first) gets a clean slate.
  ; The deletes are expected to fail with code 1 on first install ("no matching
  ; rules"); we Pop the result to keep the NSIS stack balanced but ignore it.
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Liquid Relay"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Liquid Relay (mDNS)"'
  Pop $0

  ; Inbound TCP on 53000 for the Liquid Relay server. If a user changes the
  ; port at runtime, the in-app "Fix Windows Firewall" button refreshes the
  ; rule with their custom port.
  nsExec::Exec 'netsh advfirewall firewall add rule name="Liquid Relay" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" protocol=TCP localport=53000 enable=yes profile=any'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Warning: failed to add Liquid Relay TCP firewall rule (exit $0)"
  ${EndIf}

  ; Inbound UDP 5353 for mDNS reception.
  nsExec::Exec 'netsh advfirewall firewall add rule name="Liquid Relay (mDNS)" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" protocol=UDP localport=5353 enable=yes profile=any'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Warning: failed to add Liquid Relay mDNS firewall rule (exit $0)"
  ${EndIf}
!macroend

!macro customUnInstall
  DetailPrint "Removing Liquid Relay Windows Firewall rules..."
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Liquid Relay"'
  Pop $0
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Liquid Relay (mDNS)"'
  Pop $0
!macroend
