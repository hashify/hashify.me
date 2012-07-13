# Hashify

Hashify does not solve a problem, it poses a question: what becomes possible
when one is able to store entire documents in URLs?

  - [Hashify overview](http://bit.ly/dXYxGU)
  - [Hacker News thread](http://news.ycombinator.com/item?id=2464213)

### Running Hashify locally

    npm install
    cake server
    open http://127.0.0.1:3000

### Deploying Hashify

    git pull origin master
    cake --ga-key UA-22176121-1 --output ./concat.min.js build:scripts
