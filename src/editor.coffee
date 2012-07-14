{longestQueryString} = Hashify.location
{maxHashLength, root} = Hashify.settings
{$, addEvent, publish, subscribe} = Hashify.utils

counter = $('counter')
danger = 2083 - "#{root}#!/#{longestQueryString}".length

subscribe 'hashchange', (hash) ->
  counter.innerHTML = length = hash.length
  counter.className =
    if length > danger # too long for old versions of IE
      'danger'
    else if length > maxHashLength # too long to send to bitly
      'caution'
    else
      ''

sidebar = $('sidebar')
dragger = $('dragger')
draggerPosition = dragging = undefined

preferredWidth = +localStorage.w or 0
sidebarVisibleWidth = sidebarMinimumWidth =
  parseInt getComputedStyle(sidebar, null).getPropertyValue('width'), 10

resizeSidebar = (width) ->
  # We could return immediately if `width == sidebarVisibleWidth`.
  # Since we expect horizontal dragging, though, the optimization
  # isn't worth its bytes.
  if width < sidebarMinimumWidth
    sidebar.style.left = "#{ width - sidebarMinimumWidth }px"
    sidebar.style.width = "#{ sidebarMinimumWidth }px"
  else
    sidebar.style.left = 0
    sidebar.style.width = "#{ width }px"
  publish 'editor:resized', sidebarVisibleWidth = width

subscribe 'editor:hide', ->
  resizeSidebar 0

subscribe 'editor:show', ->
  width = Math.max sidebarMinimumWidth, preferredWidth
  resizeSidebar width if width > sidebarVisibleWidth

subscribe 'editor:resize', ->
  resizeSidebar preferredWidth if preferredWidth > sidebarMinimumWidth

addEvent dragger, 'selectstart', -> false # prevent text selection

windowWidth = undefined

addEvent dragger, 'mousedown', (event) ->
  windowWidth = window.innerWidth or Infinity
  document.body.className = 'dragging'
  draggerPosition = (event or window.event).pageX
  dragging = yes

addEvent document, 'mousemove', (event) ->
  return unless dragging

  x = (event || window.event).pageX
  w = Math.max 0, sidebarVisibleWidth + x - draggerPosition

  # Restrict maximum width to `windowWidth` - 15 (scrollbar width)
  # - 4 (`#dragger` width + borders).
  if w < windowWidth - 18
    resizeSidebar localStorage.w = preferredWidth = w
    draggerPosition = x

addEvent document, 'mouseup', ->
  return unless dragging
  document.body.className = ''
  dragging = no

editor = $('markdown')
lastEditorValue = undefined

setValue = (text, start, end) ->
  # Firefox and its ilk reset `scrollTop` whenever we assign
  # to `editor.value`. To preserve scroll position we record
  # the offset before assignment and reinstate it afterwards.
  scrollTop = editor.scrollTop
  editor.value = lastEditorValue = text
  editor.scrollTop = scrollTop

  if start?
    editor.focus()
    editor.setSelectionRange start, end
    publish 'hashchange', Hashify.encode text
    publish 'render', text

# Prevent typing from inadvertently triggering keyboard shortcuts.
addEvent editor, 'keydown', (event) ->
  (event or window.event).stopPropagation()

addEvent editor, 'keyup', ->
  # In Chrome, if `editor` has focus, this function is invoked when
  # one hits "enter" in the location bar! Without this check, if one
  # were to type "twitter.com" into the location bar and hit "enter",
  # the ensuing chain of events would result in the current location
  # replacing "twitter.com" in the location bar, and no Twitter. >.<

  # If `editor.value` has changed since last we checked, we go ahead
  # and update the view. If it has _not_ changed, as will be the case
  # when one hits "enter" in the location bar, we needn't do anything.
  unless lastEditorValue is lastEditorValue = @value
    publish 'hashchange', Hashify.encode @value
    publish 'render', @value

addEvent editor, 'dragenter', -> false

addEvent editor, 'dragover', -> false

addEvent editor, 'drop', (event) ->
  {dataTransfer} = event
  url = dataTransfer.getData 'URL'

  insertImage = (uri) ->
    {value} = editor
    start = editor.selectionStart
    end = editor.selectionEnd
    {files} = dataTransfer

    alt =
      value.substring(start, end) or
      name = files?[0]?.name and name.substr(0, name.lastIndexOf '.') or 'alt'

    setValue(
      "#{ value.substr 0, start }![#{ alt }](#{ uri })#{ value.substr end }"
      pos = start + '!['.length
      pos + alt.length
    )

  insertLink = (uri) ->
    {value} = editor
    start = editor.selectionStart
    end = editor.selectionEnd
    text = value.substring start, end

    setValue(
      "#{ value.substr 0, start }[#{ text }](#{ uri })#{ value.substr end }"
      pos = start + '['.length
      pos + text.length
    )

  insertText = (text) ->
    {value} = editor
    start = editor.selectionStart
    end = editor.selectionEnd

    setValue(
      value.substr(0, start) + text + value.substr(editor.selectionEnd)
      start
      start + text.length
    )

  if url.split('.').pop() in ['gif', 'jpeg', 'jpg', 'png']
    insertImage url
  else if url
    insertLink url
  else
    return unless typeof FileReader is 'function'
    return unless file = dataTransfer.files[0]
    return unless (type = file.type.split('/')[0]) in ['image', 'text']

    reader = new FileReader()
    if type is 'image'
      reader.onload = (event) -> insertImage event.target.result
      reader.readAsDataURL file
    else
      reader.onload = (event) -> insertText event.target.result
      reader.readAsText file
    event.preventDefault()

Hashify.editor editor, no

Hashify.editor.value = (args...) ->
  if args.length then setValue args... else editor.value
