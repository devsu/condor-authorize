const Authorizer = require('./lib/authorizer');

module.exports = (options) => {
  const authorizer = new Authorizer(options);
  return authorizer.getMiddleware();
};
