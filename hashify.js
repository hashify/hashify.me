(function () {

  var

    $ = function (id) {
      return document.getElementById(id);
    },

    ____ = '    ',

    editor = $('markdown'),

    shorten = $('shorten'),

    wrapper = $('wrapper'),

    hashifyMe = 'http://hashify.me/',

    shortUrlVisible,

    encode = function (text) {
      return unescape(encodeURIComponent(text));
    },

    decode = function (text) {
      return decodeURIComponent(escape(text));
    },

    documentHash = function () {
      return location.pathname.substr(1) || location.hash.substr(3);
    },

    // logic borrowed from https://github.com/jquery/jquery
    parseJSON = function (data) {
      if (typeof data !== 'string' || !data) {
        return null;
      }
      data = data.replace(/^\s+|\s+$/g, '');
      if (
        /^[\],:{}\s]*$/
          .test(
            data
              .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
              .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g, ']')
              .replace(/(?:^|:|,)(?:\s*\[)+/g, '')
          )
      )
      return (
        window.JSON && window.JSON.parse?
          window.JSON.parse(data):
          new Function('return ' + data)()
      );
      throw 'SyntaxError';
    },

    resolve = function (reSelection, reBefore, reAfter, open, close) {
      var
        openLen = open.length,
        selection = new Selection(),
        before = selection.before,
        after = selection.after,
        start = before.length,
        text = selection.toString(),
        len = text.length;

      close || (close = open);

      selection.textarea.value = (
        reSelection.test(text)?
          (len -= openLen + close.length, before + text.substr(openLen, len) + after):
          reAfter.test(after) && reBefore.test(before)?
            (start -= openLen, before.substr(0, start) + text + after.substr(close.length)):
            (start += openLen, before + open + text + close + after));

      selection.textarea.setSelectionRange(start, start + len);
      return false;
    },

    sendRequest = function (action, params, success) {
      var request = new XMLHttpRequest();
      request.open('GET',
        'http://api.bitly.com/v3/' + action + '?login=davidchambers&' +
        'apiKey=R_20d23528ed6381ebb614a997de11c20a&' + params
      );
      request.onreadystatechange = function () {
        if (request.readyState === 4) {
          if (request.status === 200) {
            success.call(null, parseJSON(request.responseText).data);
          }
        }
      };
      request.send();
    },

    setLocation = (function () {
      return (
        history && history.pushState?
          function (hash) { history.pushState(null, null, '/' + hash); }:
          function (hash) { location.hash = '#!/' + hash; });
    }()),

    setTitle = (function () {
      var div = document.createElement('div');
      return function () {
        var match = editor.value.match(/^.*$/m);
        if (match) {
          div.innerHTML = new Showdown().convert(match[0]);
          document.title = div.textContent;
        }
      };
    }()),

    setShortUrl = function (data) {
      wrapper.innerHTML = (
        ['<a id="shorturl" href="', '">', '</a>'].join(data.url)
      );
      selection = getSelection();
      selection.selectAllChildren(wrapper);
      shorten.style.display = 'none';
      shortUrlVisible = true;
    },

    setValue = function (text) {
      $('markup').innerHTML = new Showdown().convert(text);
    };

  function Selection(re, prefix, prefix0) {
    var
      value = (this.value = this.textarea.value),
      start = (this.start = this.textarea.selectionStart),
      end   = (this.end   = this.textarea.selectionEnd);

    this.textRegex   = new RegExp('^' + re);
    this.beforeRegex = new RegExp('^' + re + '$', 'm');

    this.prefix_ = prefix;
    this.prefix0 = prefix0 || prefix;

    this.before = value.substr(0, start);
    this.after = value.substr(end);
    this.lines = value.substring(start, end).split(/\r?\n/g);
  }

  Selection.prototype.textarea = editor;

  Selection.prototype.each = function (iterator) {
    var
      lines = this.lines,
      i = lines.length;

    while (i--) {
      iterator.call(this, lines[i], i, lines);
    }
    return this;
  };

  Selection.prototype.blockify = function () {
    var
      b = this.before,
      a = this.after;

    /((\r?\n){2}|^\s*)$/.test(b) || (this.before = b.replace(/\s*$/, '\n\n'));
    /^((\r?\n){2}|\s*$)/.test(a) || (this.after  = a.replace(/^\s*/, '\n\n'));

    return this;
  };

  Selection.prototype.prefix = function () {
    return this.each(function (line, index, lines) {
      lines[index] = (index ? this.prefix_ : this.prefix0) + line;
    });
  };

  Selection.prototype.unprefix = function () {
    return this.each(function (line, index, lines) {
      lines[index] = line.replace(index ? this.prefix_ : this.prefix0, '');
    });
  };

  Selection.prototype.join = function () {
    this.lines = [this.lines.join(' ').replace(/\s+/g, ' ')];
    return this;
  };

  Selection.prototype.render = function () {
    var
      matches = this.beforeRegex.exec(this.before),
      offset = 0,
      start,
      text;

    if (matches) {
      if (this.insertHeading) {
        this.before = this.before.replace(this.beforeRegex, matches[1].length < 4 ? '$1# ' : '');
      } else {
        this.before = this.before.replace(this.beforeRegex, '');
        this.unprefix();
      }
    }
    else if (matches = this.textRegex.exec(this.lines[0])) {
      if (this.insertHeading) {
        this.lines[0] = this.lines[0].replace(this.textRegex, matches[1].length < 4 ? '$1# ' : '');
      } else {
        this.unprefix();
      }
    }
    else {
      this.blockify().prefix();
      offset = this.prefix0.length;
    }
    start = this.before.length;
    text = this.toString();
    this.textarea.value = this.before + text + this.after;
    this.textarea.setSelectionRange(start + offset, start + text.length);
    return this;
  };

  Selection.prototype.toString = function () {
    return this.lines.join('\n');
  };

  // EVENT HANDLERS //

  shorten.onclick = function (event) {
    var
      hash = documentHash(), i, list,
      selection, yetToReturn;

    if (18 + hash.length <= 2048) {
      sendRequest(
        'shorten',
        'longUrl=' + hashifyMe + hash,
        setShortUrl
      );
    } else {
      // 500 char chunks produce hashes <= 2000 chars
      list = editor.value.match(/[\s\S]{1,500}/g);
      i = yetToReturn = list.length;
      while (i--) {
        (function (item, index) {
          sendRequest(
            'shorten',
            'longUrl=' + hashifyMe + btoa(encode(item)),
            function (data) {
              list[index] = data.hash;
              if (!--yetToReturn) {
                sendRequest(
                  'shorten',
                  'longUrl=' + hashifyMe + 'unpack:' + list.join(','),
                  setShortUrl
                );
              }
            }
          );
        }(list[i], i));
      }
    }
    (event || window.event).preventDefault();
  };

  // improve discoverability
  editor.onfocus = function () {
    if (!this.value) {
      this.value = '# Title';
      // don't ask me why this is required
      window.setTimeout(function () {
        editor.setSelectionRange(2, 7);
      }, 0);
    }
  };

  editor.onkeyup = function () {
    if (shortUrlVisible) {
      shorten.style.display = 'block';
    }
    setLocation(btoa(encode(this.value)));
    setValue(this.value);
    setTitle();
  };

  $('strong').onclick = function () {
    return resolve(
      /^(__|\*\*).*\1$/,
      /(__|\*\*)$/, /^(__|\*\*)/,
      '**'
    );
  };

  $('em').onclick = function () {
    return resolve(
      /^[_*].*[_*]$/,
      /[_*]$/, /^[_*]/,
      '_'
    );
  };

  $('img').onclick = function () {
    return resolve(
      /^!\[.*\]\(http:\/\/\)$/,
      /!\[$/, /^\]\(http:\/\/\)/,
      '![', '](http://)'
    );
  };

  $('a').onclick = function () {
    return resolve(
      /^\[.*\]\(http:\/\/\)$/,
      /\[$/, /^\]\(http:\/\/\)/,
      '[', '](http://)'
    );
  };

  $('blockquote').onclick = function () {
    new Selection(' {0,3}>[ \\t]*', '> ').render();
    return false;
  };

  $('pre-code').onclick = function () {
    new Selection('( {4}|\t)', ____).render();
    return false;
  };

  $('ol').onclick = function () {
    new Selection(' {0,3}\\d+[.][ \\t]*', ____, ' 1. ').render();
    return false;
  };

  $('ul').onclick = function () {
    new Selection(' {0,3}[*+-][ \\t]*', ____, '  - ').render();
    return false;
  };

  $('h1').onclick = function () {
    var selection = new Selection('(#{1,6})[ \\t]*', '# ');
    selection.insertHeading = true;
    selection.join().render();
    return false;
  };

  $('hr').onclick = function () {
    var
      selection = new Selection().blockify(),
      before = selection.before,
      start = before.length;

    selection.textarea.value = before + '- - -' + selection.after;
    selection.textarea.setSelectionRange(start, start + 5);
    return false;
  };

  // INITIALIZATION //

  (function (hash) {
    var i, list;
    if (/^[A-Za-z0-9+/=]*$/.test(hash)) {
      setValue(editor.value = decode(atob(hash)));
      setTitle();
    } else if (/^unpack:/.test(hash)) {
      list = hash.substr(7).split(',');
      // the maximum number of `hash` parameters is 15
      if (list.length <= 15) {
        sendRequest(
          'expand',
          'hash=' + list.join('&hash='),
          function (data) {
            list = data.expand;
            i = list.length;
            while (i--) {
              list[i] = decode(atob(list[i].long_url.substr(18)));
            } // canonicalize: btoa('x') + btoa('y') != btoa('xy')
            setLocation(btoa(encode(list.join(''))));
            // TODO: add event handlers to make this redundant
            location.reload();
          }
        );
      }
    }
  }(documentHash()));

}());
