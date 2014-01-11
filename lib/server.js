var util = require("util");

var cheerio = require("cheerio");
var express = require("express");
var irc = require("irc");
var log = require("floorine");
var request = require("request");
var _ = require("lodash");

var settings = require("./settings");

request = request.defaults({
  sendImmediately: true,
  timeout: 10000
});


var Server = function () {
  var self = this;

  self.app = express(log);
  self.app.use(express.bodyParser());
  self.app.use(express.basicAuth(self.auth.bind(self)));
  self.app.post("/deploy/:project/:env", self.handle_deploy.bind(self));

  settings.irc.options.channels = _.keys(settings.channels);

  self.irc_client = new irc.Client(settings.irc.server, settings.irc.nick, settings.irc.options);
  self.irc_client.on("message", self.on_msg.bind(self));
  self.irc_client.on("error", function (msg) {
    log.error("IRC error:", msg);
  });
};

Server.prototype.auth = function (user, pass) {
  return settings.users[user] && settings.users[user] === pass;
};

Server.prototype.handle_deploy = function (req, res) {
  var self = this,
    msg;

  if (!req.body) {
    log.error("No request body");
    return;
  }

  msg = util.format("%s deployed %s to %s", req.user, req.params.project, req.params.env);

  _.each(self.irc_client.chans, function (channel) {
    var chan = settings.channels[channel.key];
    if (chan && _.contains(chan.announcements, "deploys")) {
      log.debug("Saying %s: %s", channel.key, msg);
      self.irc_client.say(channel.key, msg);
    }
  });

  res.send(204);
};

Server.prototype.listen = function (cb) {
  var self = this;

  log.log("Listening on port %s", settings.http_port);
  // TODO: https (need to async.parallel the app.listen()s)
  self.app.listen(settings.http_port, function (err, result) {
    if (err) {
      return cb(err, result);
    }

    log.log("Connecting to %s as %s", settings.irc.server, settings.irc.nick);
    self.irc_client.connect(3, function (result) {
      log.log("IRC connect:", result);
      // connect doesn't seem to send errors
      cb(null, result);
    });
  });
};

Server.prototype.on_msg = function (from, to, msg) {
  var self = this,
    chan = settings.channels[to],
    urls,
    url_regex = new RegExp("(?:https?:\\/\\/)?[-a-zA-Z0-9@:%._\\+~#=]{2,256}\\.[a-z]{2,4}(?::[0-9]{1-5})?\\b([-a-zA-Z0-9@:%_\\+.~#?&//=]*)", "gi");

  log.log("%s -> %s: %s", from, to, msg);

  if (from === self.nick || _.contains(settings.ignored_users, from)) {
    return;
  }

  if (to.slice(0, 1) !== "#") {
    // to = from;
    return;
  }

  if (!chan || !_.contains(chan.announcements, "urls")) {
    return;
  }

  urls = msg.match(url_regex);
  if (!urls) {
    return;
  }

  _.each(urls, function (url) {
    request.get(url, function (err, response, body) {
      var title, $;
      if (err || !body) {
        return;
      }

      if (response.statusCode >= 400) {
        title = util.format("%s", response.statusCode);
      } else {
        try {
          $ = cheerio.load(body);
        } catch (e) {
          log.error("Error loading response from %s: %s", url, e.toString());
          return;
        }
        title = $("html head title").text();
      }

      if (!title) {
        return;
      }

      if (title.length > 100) {
        title = title.slice(0, 100);
        title += "...";
      }
      self.irc_client.say(to, title);
    });
  });
};

Server.prototype.stop = function (reason, cb) {
  var self = this;

  self.irc_client.disconnect(util.format("Shutting down: %s", reason), cb);
};

exports.run = function () {
  var server = new Server();

  log.set_log_level(settings.log_level);

  function shut_down(signal) {
    log.warn("Got %s. Shutting down...", signal);
    server.stop(util.format("Got %s.", signal), function () {
      log.log("All done.");
      process.exit(0);
    });
  }

  process.on("SIGTERM", function () {shut_down("SIGTERM"); });
  process.on("SIGINT", function () {shut_down("SIGINT"); });

  server.listen(function (err) {
    if (err) {
      log.error(err);
      process.exit(1);
    }
  });
};
