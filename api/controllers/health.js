"use strict";

module.exports = {
    health: main
};

function main(req, res) {
    res.json({"status": "ok"});
}
