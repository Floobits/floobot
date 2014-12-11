var url = require("url");
var util = require("util");

var cheerio = require("cheerio");


function parse_generic(url_path, $) {
  var title = $("html head title").text();

  if (title.length > 100) {
    title = title.slice(0, 100);
    title += "...";
  }

  return title;
}

function parse_github(url_path, $) {
  var description,
    forks,
    name,
    stargazers,
    ul;

  if (url_path.match("^\\/\\w+\\/\\w+") === null) {
    return parse_generic(url_path, $);
  }

  ul = $("ul.pagehead-actions > li > a.social-count");
  stargazers = $(ul[0]).text().replace(/\s/g, "");
  forks = $(ul[1]).text().replace(/\s/g, "");
  description = $("div.repository-description").text().trim();
  name = $("a.js-current-repository").text();
  return util.format("%s (%s stars %s forks) %s", name, stargazers, forks, description);
}

function parse_twitter(url_path, $) {
  var username,
    title,
    retweets,
    favorites;

  if (url_path.match("^\\/\\w+\\/status\\/\\d+") === null) {
    return parse_generic(url_path, $);
  }

  // TODO: only do this for paths that make sense
  username = $("div.permalink-tweet-container div.permalink-header a > span.username.js-action-profile-name > b").text();
  title = $("div.permalink-tweet-container p.tweet-text").text();
  retweets = $("div.tweet-stats-container > ul.stats > li.js-stat-count.js-stat-retweets.stat-count > a > strong").text().replace(/\s/g, "");
  favorites = $("div.tweet-stats-container > ul.stats > li.js-stat-count.js-stat-favorites.stat-count > a > strong").text().replace(/\s/g, "");

  return util.format("<@%s> %s (%s retweets, %s favorites)", username, title, retweets || 0, favorites || 0);
}

function parse_youtube(url_path, $) {
  var title, views, likes, dislikes;

  if (url_path.match("^\\/watch") === null) {
    return parse_generic(url_path, $);
  }

  // TODO: only do this for paths that make sense
  title = $("#eow-title").text();
  views = $("#watch7-views-info > div.watch-view-count").text().replace(/\s/g, "");
  likes = $("#watch-like > span.yt-uix-button-content").text().replace(/\s/g, "");
  dislikes = $("#watch-dislike > span.yt-uix-button-content").text().replace(/\s/g, "");
  return util.format("%s %s views %s likes %s dislikes", title, views || 0, likes || 0, dislikes || 0);
}

function parse(msg_url, body) {
  var domain,
    parsed_url;

  try {
    $ = cheerio.load(body);
  } catch (e) {
    log.error("Error loading response from %s: %s", msg_url, e.toString());
    return;
  }

  parsed_url = url.parse(msg_url);
  // So hacky
  domain = parsed_url.hostname.split(".").slice(-2).join(".");
  switch (domain) {
    case "github.com":
      title = parse_github(parsed_url.path, $);
      break;
    case "twitter.com":
      title = parse_twitter(parsed_url.path, $);
      break;
    case "youtube.com":
      title = parse_youtube(parsed_url.path, $);
      break;
    default:
      title = parse_generic(parsed_url.path, $);
      break;
  }

  return title.replace(/[\r\n]/g, " ").trim();
}

module.exports = {
  parse: parse,
};
