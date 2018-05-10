var event = {
};

var context = {
  invokeid: 'test',
  succeed: (message) => {
    console.info(message);
    return;
  },
  fail: (message) => {
    console.error(message);
    return;
  },
};

var lambda = require("./index");
lambda.handler(event, context);