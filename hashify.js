(function () {

  var

    $ = function (id) {
      return document.getElementById(id);
    },

    ____ = '    ',

    editor = $('markdown'),

    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/
    // ... String/fromCharCode#Getting_it_to_work_with_higher_values
    fromCharCode = function (charCode) {
      if (charCode > 0xFFFF) {
        charCode -= 0x10000;
        return String.fromCharCode(
          0xD800 + (charCode >> 10),
          0xDC00 + (charCode & 0x3FF)
        );
      }
      return String.fromCharCode(charCode);
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
    var
      charCode, chars = [],
      value = this.value.replace('~', '~7e~'),
      index = 0, len = value.length;

    // https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/String/charCodeAt
    for (; index < len; ++index) {
      charCode = value.charCodeAt(index);
      if (0xD800 <= charCode && charCode < 0xDC00) {
        charCode = (charCode - 0xD800) * 0x400 + value.charCodeAt(++index) - 0xDC00 + 0x10000;
      }
      chars.push(
        charCode > 0xFF?
          '~' + charCode.toString(16) + '~':
          value[index]
      );
    }
    setLocation(btoa(chars.join('')));
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

  setValue(
    editor.value = (
      atob(location.pathname.substr(1) || location.hash.substr(3))
        .replace(
          /~([^~]+?)~/g,
          function (_, charCode) {
            return fromCharCode('0x' + charCode);
          }
        )
    )
  );
  setTitle();

}());
