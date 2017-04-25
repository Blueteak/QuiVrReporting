var express = require('express'); // Required to run server
var request = require("request"); // Required to perform Lyric Request
var bodyParser = require("body-parser"); // Required to parse AJAX query
var RateLimit = require('express-rate-limit');
var Parse = require('parse/node');

Parse.initialize("_QUIVR_"); // Replaced with Server App ID
Parse.serverURL = 'http://QUIVR_URL' // Replaced with Server IP

var apiLimiter = new RateLimit({
    windowMs: 30 * 1000, // 30 Seconds
    max: 10,
    delayMs: 0,
    message: "API Limited to 10 request every 30 seconds"
});

var app = express();

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/QuiVr', apiLimiter);

var Ignores = {
    '_User': ["updatedAt", "username", "createdAt", "fullVersion", "LatestVersion", "objectId"],
    'User': ["updatedAt", "username", "createdAt", "fullVersion", "LatestVersion", "objectId"],
    'ArcadeUser': ["updatedAt", "createdAt", "Pin", "objectId"],
    'Items': ["updatedAt", "createdAt", "objectId"],
    'FFKDiff': ["objectId", "UserID"],
    'CanyonMPDiff': ["objectId", "UserID"],
    'ArcheryRange01': ["objectId", "UserID"],
    'OwlInvaders': ["objectId", "UserID"]
};

app.get('/QuiVr/:Version/:Class', function (req, res) {
    var cls = req.params.Class;
    var Class = Parse.Object.extend(cls);
    var query = new Parse.Query(Class);
    var isUser = (cls == "User" || cls == "_User");
    var userquery = new Parse.Query(Parse.User);
    var keys = Object.keys(req.query);
    keys.forEach(function (key, index) {
        if (key != "Sort") {
            if (!isUser) {
                AddQueryValue(query, key, req.query[key], res);
            }
            else {
                AddQueryValue(userquery, key, req.query[key], res);
            }
        }
        else {
            try {
                var j = JSON.parse(req.query[key]);
                var val = j.Value;
                var stype = j.Test;
                if (val != undefined) {
                    if (stype == "Ascending") { query.ascending(val); }
                    else { query.descending(val); }
                }
            }
            catch (e) {
                res.status(400).send("Invalid JSON: " + e);
            }
        }
    });
    query.limit(20);
    if (!isUser) {
        query.find({
            success: function (results) {
                if (!results || results.length == 0) {
                    res.status(404).send("No Results Found");
                }
                else {
                    var r = JSON.stringify(results);
                    if (cls in Ignores) {
                        Ignores[cls].forEach(function (key, index) {
                            var regex = new RegExp("(\"" + key + "\":\"(.*?)\"(,)?)");
                            var old = r;
                            var i = 0;
                            while (r.search(regex) >= 0 && i < 50) {
                                r = r.replace(regex, "");
                                r = r.replace(",}", "}")
                                i++;
                            }
                        });
                    }
                    res.status(200).json(JSON.parse(r));
                }
            },
            error: function (error) {
                res.status(500).send("Error: " + error.code + " " + error.message);
            }
        });
    } else {
        userquery.first({
            success: function (results) {
                if (!results || results.length == 0) {
                    res.status(404).send("No Results Found");
                }
                else {
                    var r = JSON.stringify(results);
                    if (cls in Ignores) {
                        Ignores[cls].forEach(function (key, index) {
                            var regex = new RegExp("(\"" + key + "\":\"(.*?)\"(,)?)");
                            r = r.replace(regex, "");
                        });
                    }
                    r = r.replace(",}", "}")
                    res.status(200).json(JSON.parse(r));
                }
            },
            error: function (error) {
                res.status(500).send("Error: " + error.code + " " + error.message);
            }
        });
    }
});

function AddQueryValue(query, key, json, res) {
    try {
        var j = JSON.parse(json);
        var val = j.Value;
        var stype = j.Test;
        if (val != undefined) {
            if (!isNaN(Date.parse(val)) && isNaN(val)) {
                val = new Date(val);
            }
            else if (!isNaN(val) && parseInt(val) < 66561197987036815) // Checks number and not Steam User ID
                val = parseInt(val);
            if (stype == "Greater") { query.greaterThan(key, val); }
            else if (stype == "Less") { query.lessThan(key, val); }
            else if (stype == "Matches") { query.matches(key, val); }
            else if (stype == "NotEqual") { query.notEqualTo(key, val); }
            else { query.equalTo(key, val); }
        }
    } catch (e) {
        res.status(400).send("Invalid JSON: " + e);
    }
}

app.get('/QuiVr', function (req, res) {
    res.send(marked("# -- QuiVr Search API --\n\n## URL Structure:\n\n+ http://blueteak.io/QuiVr/  Version / Class ? Parameters in JSON format"
    + "\n\nExample: http://blueteak.io/QuiVr/1/Items?Rarity={\"Value\":\"2\",\"Test\":\"Equal\"}&Sort={\"Value\":\"Rarity\",\"Test\":\"Descending\"}" +
    "\n\n## Available Classes:\n+ _User - *Users*\n+ ArcheryRange01 - *Archery Range High Scores*\n+ ArcadeUser - *Arcade Profiles*" +
"\n+ FFKDiff - *Single Player High Scores (Canyon)*\n+ CanyonMPDiff - *Multiplayer High Scores (Canyon)*" +
"\n+ Items - *Items attainable in game*\n+ OwlInvaders - *Secret High Scores*\n\n## Available Sorting Options:\n" +
"+ Ascending\n+ Descending\n\n## Available Search Type Options:\n+ Equal\n+ NotEqual\n+ Greater\n+ Less\n\n## Queries:\n" +
"Queries are limited to 20 results with the exception of the _User query which is limited to 1 result" +
" at a time. Queries without a search parameter will return the first 20 results in the database.\n\n" +
"Errors will only be served for server issues, not for queries that don't make sense.\n\n" +
"#### API Limited to 10 requests every 30 seconds"));
});

// When running, page Live at: http://localhost:8080
app.listen(8080, function () {
    console.log('Example app listening on port 8080!');
});
