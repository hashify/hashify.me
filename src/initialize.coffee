{bitlyLimit, root} = Hashify.settings
{$, decode, publish, sendRequest, subscribe} = Hashify.utils

markup = $('markup')

subscribe 'render', (text) ->
  markup.innerHTML = marked text

subscribe 'editor:resized', (width) ->
  markup.style.marginLeft = width + 'px'

{hash, query} = Hashify.location.components()

# Initialize `#counter`.
publish 'hashchange', hash, "#{query}"

ready = ->
  value = Hashify.editor.value()
  if query.contains 'raw:yes'
    subscribe 'shorturl', (url) ->
      encoded = Hashify.encode "#{ value }\n\n[#{ url }]"
      location = 'data:text/plain;base64,' + encoded
  else
    if query.contains 'mode:presentation'
      publish 'editor:hide'
    else
      publish 'editor:resize'
      Hashify.editor.value value, 0, value.length unless hash
    document.body.removeChild $('mask')
  publish 'shorten'

if /^[A-Za-z0-9+/=]+$/.test hash
  unless window.history?.pushState or location.pathname is '/'
    # In browsers which don't provide `history.pushState`
    # we fall back to hashbangs. If `location.hash` is to be
    # the source of truth, `location.pathname` should be "/".
    location.replace '/#!/' + hash + query
  publish 'render', decode(hash), yes
  do ready
else if /^unpack:/.test hash
  list = hash.substr(7).split(',')
  # The maximum number of `hash` parameters is 15.
  if list.length <= bitlyLimit
    sendRequest 'expand', "hash=#{ list.join '&hash=' }", (data) ->
      list = data.expand
      for {long_url}, idx in list
        list[idx] = decode long_url.substr root.length
      # Canonicalize: btoa('x') + btoa('y') != btoa('xy')
      publish 'render', list.join(''), yes
      publish 'hashchange', Hashify.encode(Hashify.editor.value()), "#{query}"
      do ready
else
  do ready
