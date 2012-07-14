window.localStorage or= {}

{protocol, hostname, port} = location
root = "#{ protocol }//#{ hostname }#{ if port then ':' + port else '' }/"

Hashify.settings =
  bitlyLimit: 15
  maxHashLength: 2048 - root.length
  root: root
