{$, addEvent, publish} = Hashify.utils

kbdShortcuts = $('kbd-shortcuts')

addEvent document, 'keydown', (event) ->
  event or= window.event
  return if event.ctrlKey or event.altKey or event.metaKey

  switch event.keyCode
    when 27 # escape
      kbdShortcuts.className = ''
    when 37 # left arrow
      publish 'editor:hide'
    when 39 # right arrow
      publish 'editor:show'
    when 191, 0 # "/" or "?" (Firefox reports `keyCode` of `0` for "?")
      kbdShortcuts.className = 'active' if event.shiftKey

addEvent document, 'click', ->
  kbdShortcuts.className = ''
