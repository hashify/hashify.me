{subscribe} = Hashify.utils

extractTitle = (text) ->
  div = document.createElement 'div'
  div.innerHTML = marked text.match(/^.*$/m)[0]
  div.textContent

stylesheets = []

subscribe 'textchange', (text) ->
  while stylesheet = stylesheets.pop()
    document.head.removeChild stylesheet

  re = /^[ ]{0,3}\[stylesheet\]:[ \t]*(\S+)[ \t]*$/gm
  while match = re.exec text
    link = document.createElement 'link'
    link.rel = 'stylesheet'
    link.href = match[1]
    document.head.appendChild stylesheets[stylesheets.length] = link

  document.title = extractTitle(text) or 'Hashify'
  markup.innerHTML = marked text
