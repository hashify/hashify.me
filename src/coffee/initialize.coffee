{bitlyLimit, root} = Hashify.settings
{$, decode, sendRequest} = Hashify.utils

markup = $('markup')

Hashify.channel.subscribe 'editor:resized', (width) ->
  markup.style.marginLeft = width + 'px'

{hash, query} = Hashify.location.components()

ready = ->
  value = Hashify.editor.value()
  if query.contains 'raw:yes'
    Hashify.channel.subscribe 'shorturl', (url) ->
      encoded = Hashify.encode "#{ value }\n\n[#{ url }]"
      location.replace 'data:text/plain;base64,' + encoded
  else
    if query.contains 'mode:presentation'
      Hashify.channel.broadcast 'editor:hide'
    else
      Hashify.channel.broadcast 'editor:resize'
      Hashify.editor.value value, 0, value.length unless hash
    document.body.removeChild $('mask')
  Hashify.channel.broadcast 'shorten'

if /^[A-Za-z0-9+/=]+$/.test hash
  unless window.history?.pushState or location.pathname is '/'
    # In browsers which don't provide `history.pushState`
    # we fall back to hashbangs. If `location.hash` is to be
    # the source of truth, `location.pathname` should be "/".
    location.replace '/#!/' + hash + query
  Hashify.channel.broadcast 'hashchange', hash
  do ready
else if /^unpack:/.test hash
  list = hash.substr(7).split(',')
  # The maximum number of `hash` parameters is 15.
  if list.length <= bitlyLimit
    sendRequest 'expand', "hash=#{ list.join '&hash=' }", (data) ->
      stripRoot = (url) -> url.substr root.length
      # Canonicalize: btoa('x') + btoa('y') != btoa('xy')
      text = (decode stripRoot long_url for {long_url} in data.expand).join ''
      Hashify.channel.broadcast 'hashchange', Hashify.encode text
      do ready
else
  do ready
