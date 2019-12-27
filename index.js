const express = require("express");
const app = express();
const path = require("path");
const helmet = require("helmet");
const templateDir = path.resolve(`${process.cwd()}${path.sep}templates`);
const fetch = require("node-fetch");

app.use("/assets", express.static(path.resolve(`assets`)));
app.use(helmet());
var bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");

app.get("/", async (req, res) => {
    renderTemplate(res, req, "index.ejs", { alert: null, payload: null });
});

app.post("/", async (req, res) => {
    const token = req.body.token;
    const url = req.body.url;
    var amount = req.body.amount;
    const filter = req.body.filter;

    if (!token) return renderTemplate(res, req, "index.ejs", { alert: "A token must be specified.", payload: null });;
    if (!url) return renderTemplate(res, req, "index.ejs", { alert: "An url must be specified.", payload: null });;
    if (!amount) return renderTemplate(res, req, "index.ejs", { alert: "An amount must be specified.", payload: null });;

    amount = parseInt(amount);

    if (isNaN(amount)) return renderTemplate(res, req, "index.ejs", { alert: "You must provide a number.", payload: null });;
    if (amount < 1) return renderTemplate(res, req, "index.ejs", { alert: "You must have at least 1 winner.", payload: null });;

    var instaAPI = require("instagram-api");
    const agent = new instaAPI(token);
    const payload = {};

    payload["token"] = token;
    payload["url"] = url;
    payload["amount"] = `${amount}`;

    await agent.userSelf().then(function(result) {
      if (!result.data) return renderTemplate(res, req, "index.ejs", { alert: "Invalid access token.", payload: null });;
      payload["user"] = result.data;
    }, function(err){
      return renderTemplate(res, req, "index.ejs", { alert: "Invalid access token.", payload: null });;
    });

    var igMedia;
    try {
      igMedia = await fetch(`https://api.instagram.com/oembed/?callback=&url=${url}`).then(r => r.json());
    } catch (e) {
      return renderTemplate(res, req, "index.ejs", { alert: "Invalid instagram post url.", payload: null });;
    }

    igMedia = igMedia.media_id;
    var comments = await agent.mediaComments(igMedia).then(t => t);
    payload["remaining-requests"] = comments.remaining;
    comments = comments.data;

    if (filter) {
        payload["filter"] = filter;
        const words = filter.split(" ").map(w => w.toLowerCase());
        var validComments = [];
  
        for (var y = 0; y < comments.length; y++) {
            const comment = comments[y];
            var valid = true;
            for (var q = 0; q < words.length; q++) {
              if (!comment.text.toLowerCase().includes(words[q])) {
                valid = false;
                break;
              }
            }
            if (valid === true) validComments.push(comment);
        }
        comments = validComments;
      }
      
    if (amount > comments.length) payload["winners"] = shuffle(comments).map(w => {
        var o = { "username": w.from.username,  "content": w.text };
        return o;
    });

    payload["winners"] = [];
    comments = shuffle(comments);

    for (var i = 0; i <= amount - 1; i++) {
       payload["winners"].push({ "username": comments[i].from.username, "content": comments[i].text });
    }

    renderTemplate(res, req, "index.ejs", { alert: null, payload: payload });
});

const renderTemplate = (res, req, template, data = {}) => {
    const baseData = {
      path: req.path
    };

    res.render(path.resolve(`${templateDir}${path.sep}${template}`), Object.assign(baseData, data));
};


app.listen(8181);

function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  