{convert, subscribe} = Hashify.utils

extractTitle = (text) ->
  div = document.createElement 'div'
  div.innerHTML = convert text.match(/^.*$/m)[0]
  div.textContent

subscribe 'pre:render', (text, setEditorValue) ->
  position = text.length - 1
  if 0xD800 <= text.charCodeAt(position) < 0xDC00
    # In Chrome, if one attempts to delete a surrogate pair character,
    # only half of the pair is deleted. We strip the orphan to avoid
    # `encodeURIComponent` throwing a `URIError`.
    text = text.substr 0, position
    # Normalize textarea's value.
    setEditorValue = yes
  [text, setEditorValue]

stylesheets = []

subscribe 'render', (text, setEditorValue) ->
  while stylesheet = stylesheets.pop()
    document.head.removeChild stylesheet

  re = /^[ ]{0,3}\[stylesheet\]:[ \t]*(\S+)[ \t]*$/gm
  while match = re.exec text
    link = document.createElement 'link'
    link.rel = 'stylesheet'
    link.href = match[1]
    document.head.appendChild stylesheets[stylesheets.length] = link

  document.title = extractTitle(text) or 'Hashify'
  Hashify.editor.value text if setEditorValue
