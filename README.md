# Hashify

Hashify does not solve a problem, it poses a question: what becomes possible
when one is able to store entire documents in URLs?

  - [Hashify overview](http://bit.ly/dXYxGU)
  - [Hacker News thread](https://news.ycombinator.com/item?id=2464213)


### Installation

1.  Install [rbenv](https://github.com/rbenv/rbenv).

2.  Install dependencies:

        make setup

3.  Build:

        make

4.  Install [nginx](https://www.nginx.com/).

5.  Create a symlink to nginx.conf from wherever nginx sites live. For example:

        ln -s "$(pwd)/nginx.conf" /opt/local/etc/nginx/sites-available/hashify.me

6.  Activate the site if necessary. For example:

        ln -s ../sites-available/hashify.me /opt/local/etc/nginx/sites-enabled/hashify.me

7.  Reload nginx:

        sudo nginx -s reload


### localhost

Hashify uses [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
in its communication with bitly. Though browsers don't allow this on localhost,
one can use <https://lvh.me> for testing (lvh.me resolves to localhost).
