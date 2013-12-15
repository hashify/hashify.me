extractTitle = (text) ->
  div = document.createElement 'div'
  div.innerHTML = marked text.match(/^.*$/m)[0]
  div.textContent

stylesheets = []

Hashify.channel.subscribe 'textchange', (text) ->
  while stylesheet = stylesheets.pop()
    document.head.removeChild stylesheet

  re = /^[ ]{0,3}\[stylesheet\]:[ \t]*(\S+)[ \t]*$/gm
  while match = re.exec text
    link = document.createElement 'link'
    link.rel = 'stylesheet'
    link.href = match[1]
    document.head.appendChild stylesheets[stylesheets.length] = link

  document.title = extractTitle(text) or 'Hashify'
  options = {}
  unless Hashify.location.components().query.contains('prettify:no')
    options.highlight = (code) -> hljs.highlightAuto(code).value
  markup.innerHTML = marked text, options
