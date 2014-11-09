var util = require("util");


function parse_youtube($) {
  var title, views, likes, dislikes;
  title = $("#eow-title").text();
  views = $("#watch7-views-info > div.watch-view-count").text();
  likes = $("#watch-like > span.yt-uix-button-content").text();
  dislikes = $("#watch-dislike > span.yt-uix-button-content").text();
  return util.format("%s %s views %s likes %s dislikes", title, views, likes, dislikes);
}

function parse_twitter($) {
  var username,
    title,
    retweets,
    favorites;

  username = $("#page-container > div.permalink.light-inline-actions.stream-uncapped.has-replies > div.permalink-inner.permalink-tweet-container > div > div > div.content.clearfix > div > a > span.username.js-action-profile-name > b").text();
  title = $("#page-container > div.permalink.light-inline-actions.stream-uncapped > div.permalink-inner.permalink-tweet-container > div > div > p").text();
  retweets = $("#page-container > div.permalink.light-inline-actions.stream-uncapped.has-replies > div.permalink-inner.permalink-tweet-container > div > div > div.permalink-footer > div.js-tweet-details-fixer.tweet-details-fixer > div.js-tweet-stats-container.tweet-stats-container > ul > li.js-stat-count.js-stat-retweets.stat-count > a > strong").text();
  favorites = $("#page-container > div.permalink.light-inline-actions.stream-uncapped.has-replies > div.permalink-inner.permalink-tweet-container > div > div > div.permalink-footer > div.js-tweet-details-fixer.tweet-details-fixer > div.js-tweet-stats-container.tweet-stats-container > ul > li.js-stat-count.js-stat-favorites.stat-count > a > strong").text();

  return util.format("<@%s> %s (%s retweets, %s favorites)", username, title, retweets, favorites);
}

module.exports = {
  parse_youtube: parse_youtube,
  parse_twitter: parse_twitter,
};
