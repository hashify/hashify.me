fs = require 'fs'
path = require 'path'
{exec} = require 'child_process'

CoffeeScript = require 'coffee-script'
express = require 'express'
{parser, uglify} = require 'uglify-js'


files = [
  'prettify.js'
  'base64/base64.js'
  'showdown/lib/showdown.js'
  'showdown/lib/datetimes.js'
  'showdown/lib/abbreviations.js'
  'hashify-editor/hashify-editor.js'
  'src/hashify.coffee'
]

option '-d', '--development',   'do not minify style sheet'
option null, '--ga-key [KEY]',  'set the Google Analytics key'
option '-o', '--output [FILE]', 'write output to <file> instead of stdout'

task 'build:scripts', 'concatenate and minify JavaScript files', (options) ->
  read = (filename) ->
    data = fs.readFileSync filename, 'utf8'
    if /[.]coffee$/.test filename then CoffeeScript.compile data else data

  {ast_mangle, ast_squeeze, gen_code} = uglify
  scripts = (read f for f in files)
  if key = options['ga-key']
    scripts.push read('src/ga.coffee').replace /<KEY>/g, key
  data = gen_code ast_squeeze ast_mangle parser.parse scripts.join ';'

  if options.output? then fs.writeFileSync options.output, data, 'utf8'
  else console.log data

task 'build:styles', 'generate style sheet from Sass file', (options) ->
  args = ['--sass-dir .', '--css-dir .']
  if options.development
    args.push '--no-line-comments'
  else
    args.push '--environment production'

  exec "compass compile #{ args.join ' ' }", (err, stdout) ->
    console.log stdout.trim()

task 'server', 'start the development server', ->
  serve = (fn) -> (req, res) ->
    filename = fn req
    [first, second, rest..., last] = filename.split '/'
    if compile = first is '' and second is 'lib'
      last = last.replace /[.]js$/, '.coffee'
      filename = [first, 'src', rest..., last].join '/'

    filename = __dirname + filename
    path.exists filename, (exists) ->
      if exists
        if compile
          res.contentType 'js'
          res.send CoffeeScript.compile fs.readFileSync filename, 'utf8'
        else
          res.sendfile filename
      else
        res.redirect '/' + Buffer('# 400 Bad Request').toString('base64')

  app = express.createServer()
  app.get /^\/[A-Za-z0-9+/=]*$/, serve -> '/index.html'
  app.get /^\/unpack:[A-Za-z0-9]+(?:,[A-Za-z0-9]+)*$/, serve -> '/index.html'
  app.get '*', serve (req) -> req.route.params[0]

  port = process.env.PORT ? 3000
  app.listen port, -> console.log "listening on port #{port}"
