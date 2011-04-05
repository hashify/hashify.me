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

    pushStateExists = window.history && history.pushState,

    shortUrlVisible,

    convert = new Showdown().convert,

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

      setValue(
        editor.value = (
          reSelection.test(text)?
            (len -= openLen + close.length, before + text.substr(openLen, len) + after):
            reAfter.test(after) && reBefore.test(before)?
              (start -= openLen, before.substr(0, start) + text + after.substr(close.length)):
              (start += openLen, before + open + text + close + after)));

      editor.setSelectionRange(start, start + len);
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
        pushStateExists?
          function (hash) { history.pushState(null, null, '/' + hash); }:
          function (hash) { location.hash = '#!/' + hash; });
    }()),

    setTitle = (function () {
      var div = document.createElement('div');
      return function () {
        div.innerHTML = convert(editor.value.match(/^.*$/m)[0]);
        document.title = div.textContent || 'Hashify';
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
      $('markup').innerHTML = convert(text);
      return false;
    },

    strongClick = function () {
      return resolve(
        /^(__|\*\*).*\1$/,
        /(__|\*\*)$/, /^(__|\*\*)/,
        '**'
      );
    },

    emClick = function () {
      return resolve(
        /^[_*].*[_*]$/,
        /[_*]$/, /^[_*]/,
        '_'
      );
    };

  function Selection(re, prefix, prefix0) {
    var
      value = (this.value = editor.value),
      start = (this.start = editor.selectionStart),
      end   = (this.end   = editor.selectionEnd);

    this.textRegex   = new RegExp('^' + re);
    this.beforeRegex = new RegExp('^' + re + '$', 'm');

    this.prefix_ = prefix;
    this.prefix0 = prefix0 || prefix;

    this.before = value.substr(0, start);
    this.after = value.substr(end);
    this.lines = value.substring(start, end).split(/\r?\n/g);
  }

  Selection.prototype.each = function (iterator) {
    var
      lines = this.lines,
      i = lines.length;

    while (i--) {
      iterator.call(this, lines[i], i, lines);
    }
    return this;
  };

  Selection.prototype.isInlineCode = function () {
    var
      match = (
        convert(
          (this.before + this.toString())
            .replace('✪', '☺') + '✪` `` ' +
          this.after
            .replace('✪', '☺')
        ).match(/<code>[^<]*✪(`?)<\/code>/)
      );
    return match && match[1] + '`';
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

  Selection.prototype.render = function () {
    var
      matches = this.beforeRegex.exec(this.before),
      offset = 0, start, text, value;

    if (matches) {
      this.before = this.before.replace(this.beforeRegex, '');
      this.unprefix();
    }
    else if (matches = this.textRegex.exec(this.lines[0])) {
      this.unprefix();
    }
    else {
      this.blockify().prefix();
      offset = this.prefix0.length;
    }
    start = this.before.length;
    text = this.toString();
    editor.value = value = this.before + text + this.after;
    editor.setSelectionRange(start + offset, start + text.length);
    return value;
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
      // We've changed the editor's contents, so we should
      // update the view. The `onkeyup` handler already does
      // exactly this. The "keyup" event fires when one tabs
      // into the textarea, but not when one clicks into it.
      editor.onkeyup();
    }
  };

  editor.onkeydown = function (event) {
    event || (event = window.event);
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var
      keyCode = event.keyCode,
      selection = new Selection(),
      before = selection.before,
      after = selection.after,
      text = selection.toString(),
      position = before.length + 1;

    if (event.shiftKey) {
      if (keyCode === 56) {
        if (text || /\*\*$/.test(before) && /^\*\*/.test(after)) {
          strongClick();
          event.preventDefault();
        }
      } else if (keyCode === 189 && !/__$/.test(before)) {
        !text && /_$/.test(before) && /^_/.test(after)?
          editor.setSelectionRange(position, position):
          emClick();
        event.preventDefault();
      }
    } else if (keyCode === 192) {
      if (text) {
        return resolve(
          /^`.*`$/,
          /`$/, /^`/,
          '`'
        );
      }
      if (
        text =
          (text = selection.isInlineCode())?
            /^`/.test(after)?null:text:
            /^`/.test(after)?
              /`$/.test(before)?
                null:
                /^(``)*(?!`)/.test(after)?'``':'`':
              '``'
      ) setValue(editor.value = before + text + after);

      editor.setSelectionRange(position, position);
      event.preventDefault();
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

  $('strong').onclick = strongClick;

  $('em').onclick = emClick;

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
    return setValue(new Selection(' {0,3}>[ \\t]*', '> ').render());
  };

  $('pre-code').onclick = function () {
    return setValue(new Selection('( {4}|\t)', ____).render());
  };

  $('ol').onclick = function () {
    return setValue(new Selection(' {0,3}\\d+[.][ \\t]*', ____, ' 1. ').render());
  };

  $('ul').onclick = function () {
    return setValue(new Selection(' {0,3}[*+-][ \\t]*', ____, '  - ').render());
  };

  $('h1').onclick = function () {
    var
      matches, offset = 0, start, text,
      selection = new Selection('(#{1,6})[ \\t]*', '# ');

    selection.lines = [selection.lines.join(' ').replace(/\s+/g, ' ')];

    if (matches = selection.beforeRegex.exec(selection.before)) {
      selection.before = (
        selection.before.replace(
          selection.beforeRegex, matches[1].length < 4 ? '$1# ' : ''
        )
      );
    }
    else if (matches = selection.textRegex.exec(selection.lines[0])) {
      selection.lines[0] = (
        selection.lines[0].replace(
          selection.textRegex, matches[1].length < 4 ? '$1# ' : ''
        )
      );
    }
    else {
      selection.blockify().prefix();
      offset = selection.prefix0.length;
    }
    start = selection.before.length;
    text = selection.toString();
    setValue(editor.value = selection.before + text + selection.after);
    editor.setSelectionRange(start + offset, start + text.length);
    return false;
  };

  $('hr').onclick = function () {
    var
      selection = new Selection().blockify(),
      before = selection.before,
      start = before.length,
      text = selection.toString() === '- - -' ? '' : '- - -';

    setValue(editor.value = before + text + selection.after);
    editor.setSelectionRange(start, start + text.length);
    return false;
  };

  // INITIALIZATION //

  (function (hash) {
    var i, list;
    if (/^[A-Za-z0-9+/=]+$/.test(hash)) {
      // In browsers which don't provide `history.pushState`
      // we fall back to hashbangs. If `location.hash` is to be
      // the source of truth, `location.pathname` should be "/".
      pushStateExists || location.replace('/#!/' + hash);
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
            setValue(editor.value = list.join(''));
            hash = btoa(encode(editor.value));
            pushStateExists?
              setLocation(hash):
              location.replace('/#!/' + hash);
          }
        );
      }
    }
  }(documentHash()));

}());
